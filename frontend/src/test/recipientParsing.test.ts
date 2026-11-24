import { describe, it, expect } from 'vitest';

describe('Recipient File Parsing Simulation', () => {
  it('extracts and deduplicates valid email addresses', () => {
    const rawData = [
      'user1@example.com',
      'user2@domain.org',
      'invalid-email-address',
      'user1@example.com', // Duplicate
      '  USER3@reachinbox.ai  ',
    ];

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const extracted = rawData
      .map((e) => e.trim().toLowerCase())
      .filter((e) => emailRegex.test(e));

    const uniqueEmails = Array.from(new Set(extracted));

    expect(uniqueEmails).toHaveLength(3);
    expect(uniqueEmails).toContain('user1@example.com');
    expect(uniqueEmails).toContain('user2@domain.org');
    expect(uniqueEmails).toContain('user3@reachinbox.ai');
    expect(uniqueEmails).not.toContain('invalid-email-address');
  });
});
