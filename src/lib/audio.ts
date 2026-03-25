import { Howl } from 'howler';

// Using data URIs or public assets for sounds
// For now, we'll use simple synthesized sounds or base64 if needed, 
// but let's assume we have some standard notification sounds or we can use browser Audio API for simplicity.
// Actually, let's use simple base64 encoded short sounds or free CDN links.

const SOUNDS = {
  success: 'https://cdn.freesound.org/previews/320/320655_527080-lq.mp3', // Cha-ching
  warning: 'https://cdn.freesound.org/previews/254/254818_4397472-lq.mp3', // Alert
  click: 'https://cdn.freesound.org/previews/256/256113_3263906-lq.mp3' // Click
};

export const playSound = (type: keyof typeof SOUNDS) => {
  const sound = new Howl({
    src: [SOUNDS[type]],
    volume: 0.5,
  });
  sound.play();
};
