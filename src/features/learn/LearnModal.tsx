import React, { useState } from 'react';
import { 
  GraduationCap, 
  X, 
  BookOpen, 
  Keyboard, 
  Sparkles, 
  CheckCircle2, 
  ArrowRight, 
  ExternalLink,
  Code2,
  Bug,
  GitBranch,
  ShieldCheck,
  Search,
  Zap
} from 'lucide-react';

interface LearnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTriggerAction?: (actionId: string) => void;
}

interface TutorialLesson {
  id: string;
  category: 'Navigation' | 'Refactoring' | 'Git' | 'Debugging' | 'Quality';
  title: string;
  description: string;
  shortcut: string;
  actionId: string;
  completed?: boolean;
}

const LESSONS: TutorialLesson[] = [
  {
    id: 'nav-search-everywhere',
    category: 'Navigation',
    title: 'Search Everywhere',
    description: 'Quickly find any file, action, symbol, class, or tool window across the entire project.',
    shortcut: 'Shift + Shift',
    actionId: 'search.everywhere',
  },
  {
    id: 'nav-find-in-files',
    category: 'Navigation',
    title: 'Find in Files',
    description: 'Fast project-wide text search with regex and file mask filtering.',
    shortcut: 'Ctrl + Shift + F',
    actionId: 'search.findInFiles',
  },
  {
    id: 'refactor-format-code',
    category: 'Refactoring',
    title: 'Reformat Code',
    description: 'Format the current document according to JetBrains code style indentation.',
    shortcut: 'Ctrl + Alt + L',
    actionId: 'code.reformat',
  },
  {
    id: 'refactor-optimize-imports',
    category: 'Refactoring',
    title: 'Optimize Imports',
    description: 'Remove unused import statements and organize imports alphabetically.',
    shortcut: 'Ctrl + Alt + O',
    actionId: 'code.optimizeImports',
  },
  {
    id: 'refactor-rename',
    category: 'Refactoring',
    title: 'Rename Symbol',
    description: 'Safely rename variables, functions, and classes across the workspace.',
    shortcut: 'Shift + F6',
    actionId: 'refactor.rename',
  },
  {
    id: 'git-commit-window',
    category: 'Git',
    title: 'Commit Tool Window',
    description: 'Stage changed files, inspect diffs, and create Git commits with message templates.',
    shortcut: 'Ctrl + K',
    actionId: 'git.commit',
  },
  {
    id: 'git-tool-window',
    category: 'Git',
    title: 'Git Version Control History',
    description: 'Explore Git branches, commit history tree, and remote remotes.',
    shortcut: 'Alt + 9',
    actionId: 'view.git',
  },
  {
    id: 'debug-toggle-breakpoint',
    category: 'Debugging',
    title: 'Toggle Line Breakpoint',
    description: 'Set or remove a debugger breakpoint on the current cursor line.',
    shortcut: 'Ctrl + F8',
    actionId: 'run.toggleBreakpoint',
  },
  {
    id: 'debug-evaluate-expression',
    category: 'Debugging',
    title: 'Evaluate Expression',
    description: 'Inspect runtime variables, evaluate expressions, and watch state dynamically.',
    shortcut: 'Alt + F8',
    actionId: 'run.evaluate',
  },
  {
    id: 'quality-sonarlint',
    category: 'Quality',
    title: 'SonarQube Quality Inspection',
    description: 'Analyze bugs, vulnerabilities, and code smells against clean code standards.',
    shortcut: 'Alt + 8',
    actionId: 'view.sonar',
  },
];

export const LearnModal: React.FC<LearnModalProps> = ({
  isOpen,
  onClose,
  onTriggerAction,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [selectedLesson, setSelectedLesson] = useState<TutorialLesson>(LESSONS[0]);

  if (!isOpen) return null;

  const categories = ['ALL', 'Navigation', 'Refactoring', 'Git', 'Debugging', 'Quality'];

  const filteredLessons = activeCategory === 'ALL' 
    ? LESSONS 
    : LESSONS.filter(l => l.category === activeCategory);

  const handleRunLessonAction = (lesson: TutorialLesson) => {
    onTriggerAction?.(lesson.actionId);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-50 select-none animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div
        className="w-[720px] h-[520px] bg-[#2B2D30] border border-[#4E5157] rounded-xl shadow-2xl flex flex-col overflow-hidden text-[#DFE1E5]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-10 border-b border-[#393B40] px-4 flex items-center justify-between bg-[#1E1F22] flex-shrink-0">
          <div className="flex items-center gap-2 text-xs font-semibold text-white">
            <GraduationCap size={16} className="text-[#3574F0]" />
            <span>Learn Custom IDEA - Interactive IDE Tutorials</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-[#35373B] rounded text-[#868A91] hover:text-[#DFE1E5]">
            <X size={15} />
          </button>
        </div>

        {/* Category Tabs */}
        <div className="h-9 border-b border-[#393B40] px-3 flex items-center gap-1 bg-[#2B2D30] flex-shrink-0 text-xs">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1 rounded font-medium transition-colors ${
                activeCategory === cat ? 'bg-[#3574F0] text-white' : 'text-[#868A91] hover:text-[#DFE1E5]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Master-Detail Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Lesson List */}
          <div className="w-64 border-r border-[#393B40] overflow-y-auto p-2 space-y-1 bg-[#1E1F22]">
            {filteredLessons.map((lesson) => {
              const isSelected = selectedLesson.id === lesson.id;
              return (
                <div
                  key={lesson.id}
                  onClick={() => setSelectedLesson(lesson)}
                  className={`p-2 rounded cursor-pointer transition-colors text-xs flex flex-col gap-1 ${
                    isSelected ? 'bg-[#3574F0] text-white' : 'hover:bg-[#2B2D30] text-[#DFE1E5]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold truncate">{lesson.title}</span>
                    <span className={`text-[10px] font-mono px-1 rounded ${isSelected ? 'bg-white/20 text-white' : 'bg-[#2B2D30] text-[#868A91]'}`}>
                      {lesson.shortcut}
                    </span>
                  </div>
                  <span className={`text-[11px] truncate ${isSelected ? 'text-white/80' : 'text-[#868A91]'}`}>
                    {lesson.category}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Right Lesson Detail */}
          <div className="flex-1 p-5 flex flex-col justify-between overflow-y-auto bg-[#2B2D30]">
            <div className="space-y-4">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#3574F0] bg-[#3574F0]/15 px-2 py-0.5 rounded border border-[#3574F0]/30">
                  {selectedLesson.category}
                </span>
                <h3 className="text-base font-bold text-white mt-2">{selectedLesson.title}</h3>
                <p className="text-xs text-[#868A91] mt-1 leading-relaxed">
                  {selectedLesson.description}
                </p>
              </div>

              {/* Shortcut Key Display */}
              <div className="bg-[#1E1F22] border border-[#393B40] rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Keyboard size={16} className="text-[#85B1F8]" />
                  <span className="text-xs font-medium text-white">Default Keybinding:</span>
                </div>
                <kbd className="px-2.5 py-1 bg-[#2B2D30] border border-[#4E5157] rounded text-xs font-mono font-bold text-[#85B1F8] shadow-sm">
                  {selectedLesson.shortcut}
                </kbd>
              </div>

              {/* Learning Highlights */}
              <div className="bg-[#1E1F22]/60 border border-[#393B40] rounded-lg p-3 space-y-2 text-xs">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <Sparkles size={13} className="text-[#EDA200]" />
                  <span>Pro Tip</span>
                </span>
                <p className="text-[#868A91] leading-relaxed">
                  You can invoke this action at any time from anywhere in the IDE using the shortcut above, or through the <strong className="text-white">Help &rarr; Find Action (Ctrl+Shift+A)</strong> palette.
                </p>
              </div>
            </div>

            {/* Bottom Action Footer */}
            <div className="pt-4 border-t border-[#393B40] flex items-center justify-between">
              <span className="text-[11px] text-[#868A91]">Practice hands-on in current project</span>
              <button
                onClick={() => handleRunLessonAction(selectedLesson)}
                className="px-4 py-1.5 bg-[#3574F0] hover:bg-[#437EEB] text-white font-medium rounded text-xs flex items-center gap-2 transition-colors shadow-sm"
              >
                <span>Try It Now ({selectedLesson.shortcut})</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
