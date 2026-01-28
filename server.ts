import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const PORT = process.env.PORT || 3000;

// Ensure output directory exists
const outputDir = path.join(process.cwd(), 'public', 'videos');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

app.post('/render', async (req, res) => {
  console.log('📹 Received render request');
  
  try {
    const { code, durationInFrames = 150 } = req.body;

    if (!code) {
      return res.status(400).json({ 
        success: false, 
        error: 'No code provided' 
      });
    }

    console.log('✍️  Creating temporary component...');
    
    // Create temp directory
    const tempId = `render-${Date.now()}`;
    const tempDir = path.join(process.cwd(), 'temp', tempId);
    fs.mkdirSync(tempDir, { recursive: true });

    // Write component
    const componentPath = path.join(tempDir, 'Video.tsx');
    fs.writeFileSync(componentPath, code);

    // Create a simple entry file
    const entryPath = path.join(tempDir, 'index.ts');
    const entryCode = `
import { Composition } from 'remotion';
import { MyVideo } from './Video';

export const RemotionRoot = () => {
  return (
    <Composition
      id="MyVideo"
      component={MyVideo}
      durationInFrames={${durationInFrames}}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
`;
    fs.writeFileSync(entryPath, entryCode);

    // Output path
    const videoFileName = `video-${Date.now()}.mp4`;
    const outputPath = path.join(outputDir, videoFileName);

    console.log('🎥 Rendering with Remotion CLI...');

    // Use Remotion CLI directly
    const renderProcess = spawn('npx', [
      'remotion',
      'render',
      entryPath,
      'MyVideo',
      outputPath,
      '--codec=h264'
    ], {
      cwd: process.cwd(),
      stdio: 'pipe'
    });

    let renderOutput = '';
    renderProcess.stdout.on('data', (data) => {
      const output = data.toString();
      renderOutput += output;
      console.log(output);
    });

    renderProcess.stderr.on('data', (data) => {
      console.error(data.toString());
    });

    renderProcess.on('close', (exitCode) => {
      // Clean up
      fs.rmSync(tempDir, { recursive: true, force: true });

      if (exitCode === 0) {
        console.log('✅ Video rendered successfully!');
        res.json({
          success: true,
          videoUrl: `/videos/${videoFileName}`,
          message: 'Video rendered successfully',
        });
      } else {
        console.error('❌ Render failed with code:', exitCode);
        res.status(500).json({
          success: false,
          error: `Render failed with exit code ${exitCode}`,
          output: renderOutput
        });
      }
    });

  } catch (error: any) {
    console.error('❌ Render error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Remotion render server is running' 
  });
});

app.use('/videos', express.static(path.join(process.cwd(), 'public', 'videos')));

app.listen(PORT, () => {
  console.log(`🚀 Remotion render server running on port ${PORT}`);
  console.log(`📹 Videos will be served from: ${outputDir}`);
});