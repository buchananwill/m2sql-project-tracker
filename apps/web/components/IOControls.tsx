'use client';

import { Stack, Title, Divider } from '@mantine/core';
import { FileUpload } from './FileUpload';
import { SyncControls } from './SyncControls';

interface IOControlsProps {
  onFileLoad: (content: string, filename: string) => void;
}

export function IOControls({ onFileLoad }: IOControlsProps) {
  return (
    <Stack gap="md">
      <Title order={4}>Data Operations</Title>

      <FileUpload onFileLoad={onFileLoad} />

      <Divider />

      <SyncControls />
    </Stack>
  );
}
