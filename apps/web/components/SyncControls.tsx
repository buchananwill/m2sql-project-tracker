'use client';

import { Button, Group, Alert, Stack, Text } from '@mantine/core';
import { IconCloudUpload, IconCloudDownload } from '@tabler/icons-react';
import { useAppStore } from '@/stores/useAppStore';

export function SyncControls() {
  // Subscribe to store
  const database = useAppStore((state) => state.database);
  const syncState = useAppStore((state) => state.syncState);
  const setDatabase = useAppStore((state) => state.setDatabase);
  const updateMermaidText = useAppStore((state) => state.updateMermaidText);
  const setSyncLoading = useAppStore((state) => state.setSyncLoading);
  const setSyncError = useAppStore((state) => state.setSyncError);
  const setSyncSuccess = useAppStore((state) => state.setSyncSuccess);
  const resetSyncState = useAppStore((state) => state.resetSyncState);

  const handlePush = async () => {
    if (!database) {
      setSyncError('No database to push');
      return;
    }

    setSyncLoading(true);
    resetSyncState();

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
      setSyncSuccess('Successfully pushed to Supabase!');
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handlePull = async () => {
    setSyncLoading(true);
    resetSyncState();

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
      setSyncSuccess('Successfully pulled from Supabase!');

      // Update the database in store
      if (result.database) {
        setDatabase(result.database, 'supabase');
        // Clear the editor to show we're viewing Supabase data
        updateMermaidText('');
      }
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  return (
    <Stack gap="md">
      <Group gap="xs" grow>
        <Button
          leftSection={<IconCloudUpload size={16} />}
          onClick={handlePush}
          loading={syncState.loading}
          disabled={!database}
          size="sm"
        >
          Push
        </Button>
        <Button
          leftSection={<IconCloudDownload size={16} />}
          variant="outline"
          onClick={handlePull}
          loading={syncState.loading}
          size="sm"
        >
          Pull
        </Button>
      </Group>

      {syncState.error && (
        <Alert color="red" title="Error">
          {syncState.error}
        </Alert>
      )}

      {syncState.success && (
        <Alert color="green" title="Success">
          {syncState.success}
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
