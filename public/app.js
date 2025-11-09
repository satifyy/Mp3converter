const form = document.getElementById('convert-form');
const fileInput = document.getElementById('video-file');
const statusBox = document.getElementById('status');
const resultBox = document.getElementById('result');
const fileLabel = document.querySelector('.file-input span');
const uploadGroup = document.getElementById('upload-progress');
const conversionGroup = document.getElementById('conversion-progress');
const uploadBar = document.getElementById('upload-bar');
const conversionBar = document.getElementById('conversion-bar');
const uploadLabel = document.getElementById('upload-label');
const conversionLabel = document.getElementById('conversion-label');

const setStatus = (message, type = '') => {
  statusBox.textContent = message;
  statusBox.classList.remove('hidden', 'success', 'error');
  if (type) {
    statusBox.classList.add(type);
  }
};

const setResult = (content) => {
  resultBox.innerHTML = content;
  resultBox.classList.remove('hidden');
};

const clearResult = () => {
  resultBox.innerHTML = '';
  resultBox.classList.add('hidden');
};

const hideGroup = (group) => group.classList.add('hidden');
const showGroup = (group) => group.classList.remove('hidden');

const setProgress = (barElement, labelElement, value) => {
  const percent = Math.max(0, Math.min(100, Math.round(value)));
  barElement.style.width = `${percent}%`;
  labelElement.textContent = `${percent}%`;
  const track = barElement.parentElement;
  if (track) {
    track.setAttribute('aria-valuenow', String(percent));
  }
};

const resetProgress = () => {
  hideGroup(uploadGroup);
  hideGroup(conversionGroup);
  setProgress(uploadBar, uploadLabel, 0);
  setProgress(conversionBar, conversionLabel, 0);
};

const uploadWithProgress = ({ formData, onUploadProgress, onUploadComplete }) =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/convert');

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
        onUploadProgress?.(percent);
      }
    };

    xhr.upload.onload = () => {
      onUploadComplete?.();
    };

    xhr.onreadystatechange = () => {
      if (xhr.readyState === XMLHttpRequest.DONE) {
        try {
          const responseJson = JSON.parse(xhr.responseText || '{}');
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(responseJson);
          } else {
            reject(new Error(responseJson.error || 'Conversion failed'));
          }
        } catch {
          reject(new Error('Unexpected server response.'));
        }
      }
    };

    xhr.onerror = () => reject(new Error('Network error while uploading.'));
    xhr.send(formData);
  });

const startConversionPolling = (jobId, onUpdate) => {
  let cancelled = false;

  const poll = async () => {
    if (cancelled) return;
    try {
      const response = await fetch(`/api/progress/${jobId}`);
      if (response.ok) {
        const payload = await response.json();
        onUpdate(payload);
        if (payload.status === 'completed' || payload.status === 'error') {
          return;
        }
      }
    } catch {
      // Ignore polling errors and try again.
    }
    if (!cancelled) {
      setTimeout(poll, 750);
    }
  };

  poll();

  return () => {
    cancelled = true;
  };
};

const getJobId = () => {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `job-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

fileInput.addEventListener('change', () => {
  fileLabel.textContent = fileInput.files[0]?.name || 'Select a video file';
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearResult();
  resetProgress();

  if (!fileInput.files.length) {
    setStatus('Please choose a video file before converting.', 'error');
    return;
  }

  const jobId = getJobId();
  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  setStatus('Uploading your video...', '');

  showGroup(uploadGroup);
  setProgress(uploadBar, uploadLabel, 0);

  const data = new FormData();
  data.append('video', fileInput.files[0]);
  data.append('jobId', jobId);

  let stopPolling;

  try {
    const payload = await uploadWithProgress({
      formData: data,
      onUploadProgress: (value) => setProgress(uploadBar, uploadLabel, value),
      onUploadComplete: () => {
        setProgress(uploadBar, uploadLabel, 100);
        setStatus('Upload complete. Converting...', '');
        showGroup(conversionGroup);
        setProgress(conversionBar, conversionLabel, 0);
        stopPolling = startConversionPolling(jobId, ({ progress = 0 }) => {
          showGroup(conversionGroup);
          setProgress(conversionBar, conversionLabel, progress);
        });
      },
    });
    setProgress(conversionBar, conversionLabel, 100);
    setStatus('Conversion complete!', 'success');
    setResult(
      `<p class="success">Your MP3 is ready.</p>
       <a class="download-link" href="${payload.downloadUrl}" download="${payload.file}">Download ${payload.file}</a>`
    );
  } catch (error) {
    setStatus(error.message || 'Something went wrong.', 'error');
    resetProgress();
  } finally {
    submitBtn.disabled = false;
    if (stopPolling) {
      stopPolling();
    }
  }
});
