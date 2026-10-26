export type PluginCategory = 
  | 'All' 
  | 'UI Themes' 
  | 'Tools' 
  | 'Keymaps' 
  | 'Languages' 
  | 'AI & Cloud';

export interface PluginItem {
  id: string;
  name: string;
  author: string;
  version: string;
  description: string;
  category: PluginCategory;
  downloads: string;
  rating: number;
  icon: string;
  installed: boolean;
  enabled: boolean;
  hasSettings?: boolean;
  badge?: string;
  tags?: string[];
}

export const BUILTIN_PLUGINS: PluginItem[] = [
  {
    id: 'key-promoter-x',
    name: 'Key Promoter X',
    author: 'Dmitry Batkovich & JetBrains Community',
    version: '2025.1.2',
    description: 'Helps to learn essential IntelliJ shortcuts by displaying a notification balloon whenever mouse clicks are used instead of keyboard shortcuts.',
    category: 'Tools',
    downloads: '8.4M',
    rating: 4.9,
    icon: 'Keyboard',
    installed: true,
    enabled: true,
    hasSettings: true,
    badge: 'Essential',
    tags: ['productivity', 'shortcuts', 'keyboard', 'coach']
  },
  {
    id: 'rainbow-brackets',
    name: 'Rainbow Brackets',
    author: 'izhangzhihao',
    version: '2025.2.0',
    description: 'Colorizes matching parenthesis, brackets, and braces with distinctive vivid rainbow palettes to ease nested code readability.',
    category: 'UI Themes',
    downloads: '15.2M',
    rating: 4.8,
    icon: 'Palette',
    installed: true,
    enabled: true,
    badge: 'Popular',
    tags: ['brackets', 'colors', 'syntax', 'rainbow']
  },
  {
    id: 'atom-material-icons',
    name: 'Atom Material Icons',
    author: 'Elior Boukhobza',
    version: '95.0.0',
    description: 'Vibrant, beautifully handcrafted file and folder icons for project trees matching exact file types, languages, and frameworks.',
    category: 'UI Themes',
    downloads: '12.8M',
    rating: 4.9,
    icon: 'Boxes',
    installed: true,
    enabled: true,
    tags: ['icons', 'material', 'folders', 'ui']
  },
  {
    id: 'git-toolbox',
    name: 'GitToolBox',
    author: 'Lukasz Zielinski',
    version: '2025.1.0',
    description: 'Supercharges Git with inline commit blame annotations, branch status on status bar, and behind/ahead commit indicators.',
    category: 'Tools',
    downloads: '9.6M',
    rating: 4.8,
    icon: 'GitBranch',
    installed: true,
    enabled: true,
    tags: ['git', 'vcs', 'blame', 'branch']
  },
  {
    id: 'nyan-progress',
    name: 'Nyan Progress Bar',
    author: 'Dmitry Minaev',
    version: '1.14.0',
    description: 'Replaces standard compilation and indexing loading bars with an animated retro 8-bit Nyan Cat leaving a rainbow trail.',
    category: 'UI Themes',
    downloads: '3.1M',
    rating: 4.9,
    icon: 'Sparkles',
    installed: true,
    enabled: true,
    badge: 'Fun',
    tags: ['nyan', 'progress', 'cat', 'fun']
  },
  {
    id: 'docker-integration',
    name: 'Docker Integration',
    author: 'JetBrains',
    version: '2025.1.0',
    description: 'Full support for Dockerfiles, docker-compose.yml files, container lifecycle inspection, and image management.',
    category: 'Tools',
    downloads: '18.9M',
    rating: 4.7,
    icon: 'Cloud',
    installed: true,
    enabled: true,
    tags: ['docker', 'containers', 'devops']
  },
  {
    id: 'prisma-orm',
    name: 'Prisma ORM',
    author: 'Prisma Team',
    version: '4.8.1',
    description: 'Schema highlighting, relation autocompletion, formatting, and linting for Prisma schema files.',
    category: 'Languages',
    downloads: '2.4M',
    rating: 4.8,
    icon: 'Database',
    installed: false,
    enabled: false,
    tags: ['database', 'orm', 'schema', 'prisma']
  },
  {
    id: 'rust-analyzer-pro',
    name: 'Rust Analyzer Plus',
    author: 'Rust Community',
    version: '0.4.19',
    description: 'Deep Rust code intelligence, macro expansion viewer, borrow checker diagnostics, and cargo test runner.',
    category: 'Languages',
    downloads: '6.7M',
    rating: 4.9,
    icon: 'Cpu',
    installed: false,
    enabled: false,
    badge: 'Trending',
    tags: ['rust', 'cargo', 'analyzer', 'compiler']
  }
];
