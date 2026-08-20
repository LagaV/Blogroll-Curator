export type Feed = {
  id: string;
  title: string;
  xmlUrl: string;
  htmlUrl?: string;
  description: string;
  language: string;
  folder: string;
  selected: boolean;
  country: string;
  comment: string;
  reachable: boolean | null;
  checkedAt?: string;
  checkMessage?: string;
  logoUrl?: string;
  firstSeenAt: string;
  lastSeenAt: string;
  isNew: boolean;
  greader?: { subscriptionId: string; categories: string[]; deleted?: boolean };
};

export type Library = { feeds: Feed[]; lastImportAt?: string; importName?: string };
