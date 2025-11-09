const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');

const app = express();
const PORT = process.env.PORT || 4000;

const ROOT_DIR = path.resolve(__dirname, '..');
const UPLOAD_DIR = path.join(ROOT_DIR, 'uploads');
const OUTPUT_DIR = path.join(ROOT_DIR, 'output');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

const JOB_TTL_MS = 15 * 60 * 1000;
const jobProgress = new Map();

const scheduleCleanup = (jobId) => {
  const timeout = setTimeout(() => jobProgress.delete(jobId), JOB_TTL_MS);
  if (typeof timeout.unref === 'function') {
    timeout.unref();
  }
};

const updateJobProgress = (jobId, data) => {
  if (!jobId) return;
  const current = jobProgress.get(jobId) || {};
  jobProgress.set(jobId, { ...current, ...data, updatedAt: Date.now() });
  if (data.status && ['completed', 'error'].includes(data.status)) {
    scheduleCleanup(jobId);
  }
};

// Ensure directories exist before handling requests.
for (const dir of [UPLOAD_DIR, OUTPUT_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const allowedExtensions = ['.mp4', '.mov', '.mkv', '.avi', '.webm', '.m4v'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${crypto.randomUUID()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB limit
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Please upload a video file.'));
    }
  },
});

app.use(cors());
app.use(express.json());
app.use(express.static(PUBLIC_DIR));
app.use('/output', express.static(OUTPUT_DIR));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/progress/:jobId', (req, res) => {
  const status = jobProgress.get(req.params.jobId);
  if (!status) {
    return res.status(404).json({ status: 'unknown', progress: 0 });
  }
  return res.json(status);
});

const convertToMp3 = (inputPath, outputPath, jobId) =>
  new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .format('mp3')
      .audioCodec('libmp3lame')
      .audioBitrate('192k')
      .on('progress', (progress) => {
        if (!jobId) return;
        const percent = progress.percent ? Math.min(99, Math.round(progress.percent)) : 0;
        updateJobProgress(jobId, { status: 'converting', progress: percent });
      })
      .on('end', resolve)
      .on('error', reject)
      .save(outputPath);
  });

app.post('/api/convert', upload.single('video'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Video file is required.' });
  }

  const jobId = req.body?.jobId;
  if (!jobId) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: 'Job identifier is required.' });
  }

  const originalBase = path.parse(req.file.originalname).name;
  const safeBase = originalBase.replace(/[^a-z0-9_-]/gi, '_').slice(0, 40) || 'audio';
  const outputName = `${safeBase}-${Date.now()}.mp3`;
  const outputPath = path.join(OUTPUT_DIR, outputName);

  try {
    updateJobProgress(jobId, { status: 'pending', progress: 0 });
    await convertToMp3(req.file.path, outputPath, jobId);
    fs.unlink(req.file.path, () => {});
    updateJobProgress(jobId, {
      status: 'completed',
      progress: 100,
      downloadUrl: `/output/${outputName}`,
      file: outputName,
    });
    res.json({
      message: 'Conversion successful',
      file: outputName,
      downloadUrl: `/output/${outputName}`,
    });
  } catch (error) {
    fs.unlink(req.file.path, () => {});
    if (fs.existsSync(outputPath)) {
      fs.unlink(outputPath, () => {});
    }
    updateJobProgress(jobId, {
      status: 'error',
      error: error.message || 'Conversion failed',
      progress: jobProgress.get(jobId)?.progress ?? 0,
    });
    res.status(500).json({ error: error.message || 'Conversion failed' });
  }
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  return next();
});

app.listen(PORT, () => {
  console.log(`MP3 converter running on http://localhost:${PORT}`);
});
