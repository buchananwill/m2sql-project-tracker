'use client';

import { Button, Group, Alert, Stack, Text } from '@mantine/core';
import { IconCloudUpload, IconCloudDownload } from '@tabler/icons-react';
import { useState } from 'react';
import type { Database } from '@m2sql/model';

interface SyncControlsProps {
  database: Database | null;
  onPushSuccess?: (result: any) => void;
  onPullSuccess?: (result: any) => void;
}

export function SyncControls({
  database,
  onPushSuccess,
  onPullSuccess,
}: SyncControlsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handlePush = async () => {
    if (!database) {
      setError('No database to push');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/supabase/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ database }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Push failed');
      }

      const result = await res.json();
      setSuccess('Successfully pushed to Supabase!');
      onPushSuccess?.(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handlePull = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/supabase/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ databaseName: database?.name || 'Database' }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Pull failed');
      }

      const result = await res.json();
      setSuccess('Successfully pulled from Supabase!');
      onPullSuccess?.(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack gap="md">
      <Group>
        <Button
          leftSection={<IconCloudUpload size={16} />}
          onClick={handlePush}
          loading={loading}
          disabled={!database}
        >
          Push to Supabase
        </Button>
        <Button
          leftSection={<IconCloudDownload size={16} />}
          variant="outline"
          onClick={handlePull}
          loading={loading}
        >
          Pull from Supabase
        </Button>
      </Group>

      {error && (
        <Alert color="red" title="Error">
          {error}
        </Alert>
      )}

      {success && (
        <Alert color="green" title="Success">
          {success}
        </Alert>
      )}

      {!database && (
        <Text size="sm" c="dimmed">
          Load a valid Mermaid file to enable push to Supabase
        </Text>
      )}
    </Stack>
  );
}
