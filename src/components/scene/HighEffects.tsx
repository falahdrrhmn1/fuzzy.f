'use client';

import { Bloom, EffectComposer, N8AO, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';

/**
 * Mode Bagus: ambient occlusion (kedalaman antar kelopak & lipatan kertas), bloom halus untuk lampu,
 * tone mapping Neutral. Composer mengambil alih render, jadi tone mapping renderer diganti efek ini.
 */
export default function HighEffects() {
  return (
    <EffectComposer multisampling={4}>
      <N8AO aoRadius={0.05} distanceFalloff={0.6} intensity={2.4} quality="medium" halfRes color="#3b2a22" />
      <Bloom luminanceThreshold={1.05} intensity={0.55} mipmapBlur />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
    </EffectComposer>
  );
}
