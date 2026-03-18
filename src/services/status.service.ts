import WebDAVSyncPlugin from '../index';
import { formatRelativeTime } from '../utils/format-relative-time';

export class StatusService {
	public syncStatusBar: HTMLElement;
	private lastSyncTime: number | null = null;
	private updateInterval: number | null = null;
	private baseStatusText: string = '';

	constructor(private plugin: WebDAVSyncPlugin) {
		this.syncStatusBar = plugin.addStatusBarItem();
	}

	public setCurrentStatus(text: string): void {
		this.stopTimeUpdates();
		this.syncStatusBar.setText(text);
	}

	public setLastSuccessfulStatus(timestamp: number, text: string): void {
		this.lastSyncTime = timestamp;
		this.baseStatusText = text;

		this.updateStatusBarWithTime();
		this.stopTimeUpdates();
		this.updateInterval = window.setInterval(() => {
			this.updateStatusBarWithTime();
		}, 60000);
	}

	private updateStatusBarWithTime(): void {
		if (this.lastSyncTime === null) {
			return;
		}

		const now = Date.now();
		const diffSeconds = Math.floor((now - this.lastSyncTime) / 1000);

		// Don't show relative time if less than 60 seconds (just now)
		if (diffSeconds < 60) {
			this.syncStatusBar.setText(this.baseStatusText);
		} else {
			const relativeTime = formatRelativeTime(this.lastSyncTime);
			const statusText = `${this.baseStatusText} (${relativeTime})`;
			this.syncStatusBar.setText(statusText);
		}
	}

	public stopTimeUpdates(): void {
		if (this.updateInterval !== null) {
			window.clearInterval(this.updateInterval);
			this.updateInterval = null;
		}
	}

	public unload(): void {
		this.stopTimeUpdates();
	}
}
