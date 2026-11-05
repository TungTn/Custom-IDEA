import React from 'react';
import { GitBranchPopup, GitBranchItem, GitBranchPopupProps } from './GitBranchPopup';

export { GitBranchPopup };
export type { GitBranchItem, GitBranchPopupProps };

export interface GitBranchesModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBranch: string;
  projectPath?: string;
  onSwitchBranch: (branch: string) => void;
  onCreateBranch?: (branch: string) => void;
  onShowToast?: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  onRefreshGitStatus?: () => void;
}

export const GitBranchesModal: React.FC<GitBranchesModalProps> = (props) => {
  if (!props.isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 bg-black/40 backdrop-blur-xs animate-in fade-in duration-100"
      onClick={props.onClose}
    >
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        <GitBranchPopup {...props} />
      </div>
    </div>
  );
};

export default GitBranchesModal;
