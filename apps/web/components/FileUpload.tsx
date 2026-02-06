'use client';

import { FileButton, Button, Group, Text } from '@mantine/core';
import { IconUpload } from '@tabler/icons-react';
import { useState } from 'react';

interface FileUploadProps {
  onFileLoad: (content: string, filename: string) => void;
}

export function FileUpload({ onFileLoad }: FileUploadProps) {
  const [file, setFile] = useState<File | null>(null);

  const handleFile = async (selectedFile: File | null) => {
    if (!selectedFile) return;

    setFile(selectedFile);
    const text = await selectedFile.text();
    onFileLoad(text, selectedFile.name);
  };

  return (
    <Group>
      <FileButton onChange={handleFile} accept=".mmd,.md,.txt">
        {(props) => (
          <Button {...props} leftSection={<IconUpload size={16} />}>
            Import Mermaid File
          </Button>
        )}
      </FileButton>
      {file && (
        <Text size="sm" c="dimmed">
          Loaded: {file.name}
        </Text>
      )}
    </Group>
  );
}
