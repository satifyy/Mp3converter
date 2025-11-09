# Video to MP3 Converter

Node/Express application that converts uploaded video files (MP4, MOV, MKV, WEBM, AVI, M4V) into MP3 audio. Ships with a lightweight frontend so you can run it locally or deploy it to any Node-friendly host.

## Features

- Upload videos up to 500 MB and convert them to 192 kbps MP3 audio.
- Powered by FFmpeg (bundled automatically through `@ffmpeg-installer/ffmpeg`).
- Simple UI with status messaging and download link generation.
- CORS enabled so you can host the frontend separately if desired.

## Getting Started

```bash
npm install
npm run dev   # starts Nodemon on http://localhost:4000
```

Visit `http://localhost:4000` to open the UI. Upload a video, wait for the conversion to finish, and download the generated MP3 from the provided link.

### Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4000` | Port for the Express server. |

## Deploying

1. Push this project to your Git provider (GitHub, GitLab, etc.).
2. Choose a Node hosting platform (Render, Railway, Fly.io, Azure, etc.).
3. Define the start command as `npm start`.
4. Ensure the runtime has enough temporary storage (uploads + output) and allows long-running conversions.

Because FFmpeg ships with the app, you do not need any extra system dependencies.

## Project Structure

```
├── public          # Static frontend (HTML/CSS/JS)
├── src             # Express server
├── uploads         # Temporary upload folder (created automatically)
├── output          # Converted MP3 files (served at /output)
└── package.json
```

> ⚠️ Remember to periodically clean the `uploads` and `output` folders (e.g., via cron or a background worker) if you deploy this in production.
