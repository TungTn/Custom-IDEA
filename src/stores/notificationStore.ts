import { create } from 'zustand';
import { ToastItem } from '../workbench/ToastContainer';
import { NotificationEntry } from '../workbench/RightActivityBar';

export interface NotificationState {
  toasts: ToastItem[];
  notifications: NotificationEntry[];
  addToast: (title: string, message?: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  dismissToast: (id: string) => void;
  removeNotification: (id: string) => void;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  clearNotifications: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  toasts: [],
  notifications: [
    {
      id: 'notif-1',
      title: 'Project Loaded',
      message: 'IntelliJ Virtual File System initialized successfully',
      type: 'info',
      timestamp: 'Just now',
      read: false,
    },
    {
      id: 'notif-2',
      title: 'Git Repository Detected',
      message: 'Workspace is tracking git branch [main]',
      type: 'success',
      timestamp: 'Just now',
      read: true,
    },
  ],

  addToast: (title, message, type = 'info') => {
    const id = String(Date.now() + Math.random());
    const timestamp = new Date().toLocaleTimeString();

    set((state) => ({
      toasts: [...state.toasts, { id, title, message, type }],
      notifications: [
        {
          id: `entry-${Date.now()}-${Math.random()}`,
          title,
          message,
          type,
          timestamp,
          read: false,
        },
        ...state.notifications,
      ],
    }));

    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, 4000);
  },

  dismissToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },

  markNotificationAsRead: (id) => {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    }));
  },

  markAllNotificationsAsRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    }));
  },

  clearNotifications: () => {
    set({ notifications: [] });
  },
}));
