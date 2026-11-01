import type { WorkspaceData, View } from './types';
import type { Editor } from './forms';
export type ViewProps = {
  data: WorkspaceData;
  date: string;
  params: Record<string, string | undefined>;
  demo: boolean;
  view: View;
  link: (view: View, query?: Record<string, string>) => string;
  edit: (editor: Editor) => void;
  notify: (message: string) => void;
};
