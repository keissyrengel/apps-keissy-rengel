export type AppKind = "crm" | "ecommerce" | "booking" | "dashboard" | "landing";

export type ChangeAction = "created" | "modified" | "deleted";

export interface FileChange {
  path: string;
  action: ChangeAction;
}

export interface ProjectState {
  kind: AppKind;
  name: string;
  prompt: string;
  pages: Array<{ label: string; href: string }>;
  sidebarWidth?: "default" | "narrow";
}

export interface GeneratedFile {
  path: string;
  content: string;
}

export interface GenerateResult {
  success: boolean;
  changes: FileChange[];
  error?: string;
  message?: string;
  previewUrl?: string;
  state?: ProjectState;
}

export type BuilderStatus =
  | "Planning"
  | "Reading files"
  | "Creating files"
  | "Editing"
  | "Running commands"
  | "Testing"
  | "Building"
  | "Preview ready";

export type BuildStreamEvent =
  | { type: "status"; status: BuilderStatus; detail?: string }
  | { type: "result"; result: GenerateResult };
