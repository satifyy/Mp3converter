const form = document.getElementById('convert-form');
const fileInput = document.getElementById('video-file');
const statusBox = document.getElementById('status');
const resultBox = document.getElementById('result');
const fileLabel = document.querySelector('.file-input span');
const progressWrapper = document.getElementById('progress-wrapper');
const progressBar = document.getElementById('progress-bar');
const progressLabel = document.getElementById('progress-label');

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

const resetProgress = () => {
  progressWrapper.classList.add('hidden');
  progressBar.style.width = '0%';
  progressLabel.textContent = '0%';
  progressBar.setAttribute('aria-valuenow', '0');
};

const updateProgress = (value) => {
  progressWrapper.classList.remove('hidden');
  progressBar.style.width = `${value}%`;
  progressLabel.textContent = `${value}%`;
  progressBar.setAttribute('aria-valuenow', String(value));
};

const uploadWithProgress = (formData) =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/convert');

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
        updateProgress(percent);
      }
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

  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  setStatus('Uploading and converting... this can take a moment.');

  const data = new FormData();
  data.append('video', fileInput.files[0]);

  try {
    const payload = await uploadWithProgress(data);
    updateProgress(100);
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
  }
});
