import React from 'react';
import {CalculateMetadataFunction, Composition, staticFile} from 'remotion';
import {Scene, SceneProps} from './engine/Scene';
import type {Settings, WordsFile} from './engine/types';

// Every JSON file in /settings becomes its own video (composition id = settings.name).
const ctx = require.context('../settings', false, /\.json$/);
const all = ctx.keys().map((k) => ctx(k) as Settings);

const calculateMetadata: CalculateMetadataFunction<SceneProps> = async ({props}) => {
  const s = props.settings;
  const res = await fetch(staticFile(s.audio.words));
  const file = (await res.json()) as WordsFile;
  const seconds = s.audio.offset + file.duration + s.audio.tail;
  return {
    durationInFrames: Math.ceil(seconds * s.canvas.fps),
    props: {...props, words: file.words},
  };
};

export const RemotionRoot: React.FC = () => (
  <>
    {all.map((s) => (
      <Composition
        key={s.name}
        id={s.name}
        component={Scene}
        width={s.canvas.width}
        height={s.canvas.height}
        fps={s.canvas.fps}
        durationInFrames={1}
        defaultProps={{settings: s, words: []}}
        calculateMetadata={calculateMetadata}
      />
    ))}
  </>
);
