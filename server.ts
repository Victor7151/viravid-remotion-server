import express from 'express';
import cors from 'cors';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import path from 'path';
import fs from 'fs';

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
    
    const tempId = `render-${Date.now()}`;
    const tempDir = path.join(process.cwd(), 'temp', tempId);
    fs.mkdirSync(tempDir, { recursive: true });

    const componentPath = path.join(tempDir, 'VideoComponent.tsx');
    fs.writeFileSync(componentPath, code);

    const entryCode = `
import React from 'react';
import { Composition } from 'remotion';
import { MyVideo } from './VideoComponent';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MyVideo"
        component={MyVideo}
        durationInFrames={${durationInFrames}}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
`;
    const entryPath = path.join(tempDir, 'index.tsx');
    fs.writeFileSync(entryPath, entryCode);

    console.log('📦 Bundling...');
    
    const bundleLocation = await bundle({
      entryPoint: entryPath,
      onProgress: (progress) => {
        console.log(`Bundling: ${Math.round(progress * 100)}%`);
      }
    });

    console.log('🎬 Selecting composition...');
    
    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: 'MyVideo',
      inputProps: {},
    });

    console.log('🎥 Rendering video...');
    
    const videoFileName = `video-${Date.now()}.mp4`;
    const outputPath = path.join(outputDir, videoFileName);

    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: 'h264',
      outputLocation: outputPath,
      inputProps: {},
      onProgress: (progress) => {
        console.log(`Rendering: ${Math.round(progress.progress * 100)}%`);
      }
    });

    console.log('✅ Video rendered successfully!');

    fs.rmSync(tempDir, { recursive: true, force: true });

    const videoUrl = `/videos/${videoFileName}`;
    
    res.json({
      success: true,
      videoUrl: videoUrl,
      message: 'Video rendered successfully',
    });

  } catch (error: any) {
    console.error('❌ Render error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
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
  console.log(`💡 Test with: curl http://localhost:${PORT}/health`);
});