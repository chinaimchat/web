import { Notification, BrowserWindow, ipcMain, nativeImage } from "electron";
import { join } from "path";
import { Channel } from "wukongimjssdk";

export interface ElectronNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  silent?: boolean;
  fromUid?:string
  channel?: Channel
  urgency?: 'normal' | 'critical' | 'low';
  timeoutType?: 'default' | 'never';
  actions?: Array<{
    type: 'button';
    text: string;
  }>;
}

export interface MessageData {
  channel: {
    channelID: string;
    channelType: number;
  };
  fromUID: string;
  header: {
    reddot: boolean;
    noPersist: boolean;
  };
}

class ElectronNotificationManager {
  private static instance: ElectronNotificationManager;
  private activeNotifications: Map<string, Notification> = new Map();
  private mainWindow: BrowserWindow | null = null;

  private constructor() {
    this.setupIpcHandlers();
  }

  public static getInstance(): ElectronNotificationManager {
    if (!ElectronNotificationManager.instance) {
      ElectronNotificationManager.instance = new ElectronNotificationManager();
    }
    return ElectronNotificationManager.instance;
  }

  public setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  private setupIpcHandlers(): void {
    // Handle notification requests from renderer process
    ipcMain.handle('show-native-notification', async (_event, options: ElectronNotificationOptions) => {
      return this.showNotification(options);
    });

    // Handle notification close requests
    ipcMain.handle('close-native-notification', async (_event, tag: string) => {
      this.closeNotification(tag);
    });

    // Handle close all notifications
    ipcMain.handle('close-all-native-notifications', async () => {
      this.closeAllNotifications();
    });
  }

  private getDefaultIcon(): string {
    // Return path to default app icon
    const isDevelopment = process.env.NODE_ENV !== "production";

    if (isDevelopment) {
      // In development, try multiple possible locations
      const possiblePaths = [
        join(__dirname, "../../public/logo192.png"),
        join(__dirname, "../../public/logo.png"),
        join(__dirname, "../../resources/icons/256x256.png"),
        join(__dirname, "../../resources/icons/128x128.png"),
        join(__dirname, "../../resources/logo.png")
      ];

      // Return the first path that exists
      const fs = require('fs');
      for (const path of possiblePaths) {
        if (fs.existsSync(path)) {
          console.log('Using development icon:', path);
          return path;
        }
      }

      // Fallback to the first path if none exist
      return possiblePaths[0];
    } else {
      // In production, try multiple possible locations
      const possiblePaths = [
        join(process.resourcesPath, "app/build/logo192.png"),
        join(process.resourcesPath, "app/build/logo.png"),
        join(process.resourcesPath, "app/resources/icons/256x256.png"),
        join(process.resourcesPath, "app/resources/icons/128x128.png"),
        join(process.resourcesPath, "app/resources/logo.png"),
        // Alternative paths for different build configurations
        join(process.resourcesPath, "build/logo.png"),
        join(process.resourcesPath, "resources/icons/256x256.png"),
        join(process.resourcesPath, "resources/icons/128x128.png"),
        join(process.resourcesPath, "resources/logo.png")
      ];

      // Return the first path that exists
      const fs = require('fs');
      for (const path of possiblePaths) {
        if (fs.existsSync(path)) {
          console.log('Using production icon:', path);
          return path;
        }
      }

      // Fallback to the first path if none exist
      return possiblePaths[0];
    }
  }

  private createNativeImage(iconPath?: string): Electron.NativeImage | undefined {
    const fs = require('fs');

    if (!iconPath) {
      try {
        const defaultIconPath = this.getDefaultIcon();
        console.log('Attempting to load default icon from:', defaultIconPath);

        if (!fs.existsSync(defaultIconPath)) {
          console.warn('Default icon file does not exist:', defaultIconPath);
          return undefined;
        }

        const image = nativeImage.createFromPath(defaultIconPath);
        if (image.isEmpty()) {
          console.warn('Default icon is empty or invalid:', defaultIconPath);
          return undefined;
        }

        console.log('Successfully loaded default icon:', defaultIconPath);
        return image;
      } catch (error) {
        console.warn('Could not load default icon:', error);
        return undefined;
      }
    }

    try {
      // If it's a URL, we'll need to download it first or use a placeholder
      if (iconPath.startsWith('http')) {
        console.log('URL icon detected, falling back to default icon');
        // For now, use default icon for URLs
        // In a production app, you might want to download and cache the image
        return this.createNativeImage(); // Recursive call without iconPath to use default
      } else {
        console.log('Attempting to load custom icon from:', iconPath);

        if (!fs.existsSync(iconPath)) {
          console.warn('Custom icon file does not exist:', iconPath, 'falling back to default');
          return this.createNativeImage(); // Fallback to default
        }

        const image = nativeImage.createFromPath(iconPath);
        if (image.isEmpty()) {
          console.warn('Custom icon is empty or invalid:', iconPath, 'falling back to default');
          return this.createNativeImage(); // Fallback to default
        }

        console.log('Successfully loaded custom icon:', iconPath);
        return image;
      }
    } catch (error) {
      console.warn('Could not load notification icon:', error, 'falling back to default');
      return this.createNativeImage(); // Fallback to default
    }
  }

  public showNotification(options: ElectronNotificationOptions): boolean {
    try {
      // Close existing notification with same tag
      if (options.tag) {
        this.closeNotification(options.tag);
      }

      const icon = this.createNativeImage(options.icon);
      const notification = new Notification({
        title: options.title,
        body: options.body,
        icon: icon,
        silent: options.silent || false,
        urgency: options.urgency || 'normal',
        timeoutType: options.timeoutType || 'default',
        actions: options.actions || [],
      });

      // Set up event handlers
      notification.on('click', () => {
        console.log('Notification clicked');
        // Bring main window to front
        if (this.mainWindow) {
          if (this.mainWindow.isMinimized()) {
            this.mainWindow.restore();
          }
          this.mainWindow.show();
          this.mainWindow.focus();

          // Send click event to renderer process with channel info
          this.mainWindow.webContents.send('notification-clicked', {
            tag: options.tag,
            title: options.title,
            body: options.body,
            channel: options.channel,
          });
        }
        
        // Clean up
        if (options.tag) {
          this.activeNotifications.delete(options.tag);
        }
      });

      notification.on('close', () => {
        console.log('Notification closed');
        if (options.tag) {
          this.activeNotifications.delete(options.tag);
        }
      });

      notification.on('action', (_event, index) => {
        console.log('Notification action clicked:', index);
        if (this.mainWindow) {
          this.mainWindow.webContents.send('notification-action-clicked', {
            tag: options.tag,
            actionIndex: index,
          });
        }
      });

      // Show the notification
      notification.show();

      // Store reference if tag is provided
      if (options.tag) {
        this.activeNotifications.set(options.tag, notification);
      }

      return true;
    } catch (error) {
      console.error('Failed to show native notification:', error);
      return false;
    }
  }

  public closeNotification(tag: string): void {
    const notification = this.activeNotifications.get(tag);
    if (notification) {
      notification.close();
      this.activeNotifications.delete(tag);
    }
  }

  public closeAllNotifications(): void {
    this.activeNotifications.forEach((notification) => {
      notification.close();
    });
    this.activeNotifications.clear();
  }


  /**
   * Handle call notification
   */
  public handleCallNotification = (fromUID: string, channelInfo: any, callType?: string): void => {
    console.log('Handling call notification in main process:', { fromUID, channelInfo, callType });

    const notificationOptions: ElectronNotificationOptions = {
      title: channelInfo?.orgData?.displayName || channelInfo?.title || "通知",
      body: `${channelInfo?.title || fromUID}正在呼叫您`,
      tag: `call-${fromUID}`,
      icon: undefined, // Will use default icon
      urgency: 'critical', // High priority for calls
      timeoutType: 'never', // Don't auto-dismiss call notifications
      actions: [
        { type: 'button' as const, text: '接听' },
        { type: 'button' as const, text: '拒绝' }
      ],
    };

    this.showNotification(notificationOptions);
  };

  /**
   * Handle generic notification
   */
  public handleGenericNotification = (options: {
    title: string;
    body: string;
    tag?: string;
    icon?: string;
  }): void => {
    console.log('Handling generic notification in main process:', options);

    const notificationOptions: ElectronNotificationOptions = {
      title: options.title,
      body: options.body,
      tag: options.tag,
      icon: options.icon,
      urgency: 'normal',
      timeoutType: 'default',
    };

    this.showNotification(notificationOptions);
  };

  /**
   * Test method to verify icon loading
   */
  public testIconLoading(): void {
    console.log('=== Testing Icon Loading ===');

    const defaultIconPath = this.getDefaultIcon();
    console.log('Default icon path:', defaultIconPath);

    const fs = require('fs');
    console.log('Default icon exists:', fs.existsSync(defaultIconPath));

    const icon = this.createNativeImage();
    console.log('Default icon loaded successfully:', !!icon);
    if (icon) {
      console.log('Icon size:', icon.getSize());
      console.log('Icon is empty:', icon.isEmpty());
    }

    // Test with a specific icon from resources
    const resourceIconPath = require('path').join(__dirname, "../../../resources/icons/256x256.png");
    console.log('Resource icon path:', resourceIconPath);
    console.log('Resource icon exists:', fs.existsSync(resourceIconPath));

    const resourceIcon = this.createNativeImage(resourceIconPath);
    console.log('Resource icon loaded successfully:', !!resourceIcon);
    if (resourceIcon) {
      console.log('Resource icon size:', resourceIcon.getSize());
      console.log('Resource icon is empty:', resourceIcon.isEmpty());
    }

    console.log('=== Icon Loading Test Complete ===');
  };
}

// Export singleton instance
export const electronNotificationManager = ElectronNotificationManager.getInstance();
export default ElectronNotificationManager;
