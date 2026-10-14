import { useNuiEvent } from './useNuiEvent';
import {
	NUI_NOTIFICATION_EVENT,
	type NuiNotificationMessage,
} from '@common/types';
import {
	clearAllPersistentNotifications,
	clearPersistentNotification,
	showNotification,
	showPersistentNotification,
} from '~/store/notifications';

/**
 * Single entry point for scripted notifications coming from the client script.
 * Keeps manual (React-side) calls and NUI-driven calls on the exact same store.
 */
export function useNotificationEvents() {
	useNuiEvent<NuiNotificationMessage>(NUI_NOTIFICATION_EVENT, (message) => {
		switch (message.op) {
			case 'show': {
				if (message.id) {
					showPersistentNotification(message.id, message.data);
				} else {
					showNotification(message.data);
				}
				break;
			}
			case 'clear-persistent': {
				clearPersistentNotification(message.id);
				break;
			}
			case 'clear-all-persistent': {
				clearAllPersistentNotifications();
				break;
			}
		}
	});
}
