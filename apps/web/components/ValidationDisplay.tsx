'use client';

import { Alert, List } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';

interface ValidationDisplayProps {
  errors: string[];
}

export function ValidationDisplay({ errors }: ValidationDisplayProps) {
  if (!errors || errors.length === 0) {
    return null;
  }

  return (
    <Alert icon={<IconAlertCircle />} title="Parse Errors" color="red" mt="md">
      <List>
        {errors.map((err, i) => (
          <List.Item key={i}>{err}</List.Item>
        ))}
      </List>
    </Alert>
  );
}
