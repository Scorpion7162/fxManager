import { useSyncExternalStore } from 'react';
import type { NotificationPayload, NotificationVariant } from '@common/types';

export interface NotificationEntry {
	id: string;
	title: string;
	description: string | null;
	variant: NotificationVariant;
	/** ms until auto-dismiss; `null` = persistent, cleared only via an explicit clear call */
	duration: number | null;
	persistent: boolean;
	createdAt: number;
	/** 'leaving' keeps the entry mounted for the duration of the exit animation */
	state: 'idle' | 'leaving';
}

const DEFAULT_DURATION = 5000;
/** keep in sync with the viewport's exit animation duration */
const EXIT_ANIMATION_MS = 200;
/** transient spam damper: hard-drops the oldest toast beyond this many */
const MAX_TRANSIENT = 20;

export const MAX_VISIBLE = 5;

const persistent = new Map<string, NotificationEntry>();
const transient = new Map<string, NotificationEntry>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function buildSnapshot(): NotificationEntry[] {
	return [...persistent.values(), ...transient.values()];
}

let snapshot = buildSnapshot();
const listeners = new Set<() => void>();

function emit() {
	reconcileTimers();
	snapshot = buildSnapshot();
	for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

function getSnapshot(): NotificationEntry[] {
	return snapshot;
}

/**
 * Overflow-hold: a transient toast only counts down its auto-dismiss timer
 * while it occupies one of the MAX_VISIBLE slots
 */
function reconcileTimers() {
	const ordered = [...persistent.values(), ...transient.values()];
	const visibleIds = new Set(
		ordered.slice(0, MAX_VISIBLE).map((entry) => entry.id),
	);

	for (const entry of transient.values()) {
		if (entry.state === 'leaving' || entry.duration === null) continue;

		const timerRunning = timers.has(entry.id);
		const isVisible = visibleIds.has(entry.id);

		if (isVisible && !timerRunning) {
			// just became visible after being held by overflow: restart full duration
			timers.set(
				entry.id,
				setTimeout(() => removeEntry(entry.id, true), entry.duration),
			);
		} else if (!isVisible && timerRunning) {
			// dropped into the overflow: freeze the countdown
			clearTimer(entry.id);
		}
	}
}

function clearTimer(id: string) {
	const timer = timers.get(id);
	if (timer === undefined) return;
	clearTimeout(timer);
	timers.delete(id);
}

function getEntry(id: string): NotificationEntry | undefined {
	return persistent.get(id) ?? transient.get(id);
}

/**
 * Removes an entry and plays the exit animation. Returns early when the entry
 * is already animating out (double-clear / timer race)
 */
function removeEntry(id: string, animate: boolean) {
	const existing = getEntry(id);
	if (!existing) return;

	// exit already in flight: do not reset the dispose timer
	if (existing.state === 'leaving') return;

	clearTimer(id);

	if (!animate) {
		persistent.delete(id);
		transient.delete(id);
		emit();
		return;
	}

	const leaving: NotificationEntry = { ...existing, state: 'leaving' };

	// re-insert under the same key to preserve stack ordering while animating
	transient.delete(id);
	persistent.delete(id);
	if (existing.persistent) {
		persistent.set(id, leaving);
	} else {
		transient.set(id, leaving);
	}

	emit();

	timers.set(
		id,
		setTimeout(() => {
			timers.delete(id);
			persistent.delete(id);
			transient.delete(id);
			emit();
		}, EXIT_ANIMATION_MS),
	);
}

function upsertPersistent(id: string, input: NotificationPayload) {
	const existing = getEntry(id);
	const entry: NotificationEntry = {
		id,
		title: input.title,
		description: input.description ?? null,
		variant: input.variant ?? 'info',
		duration: null,
		persistent: true,
		createdAt: existing?.createdAt ?? Date.now(),
		state: 'idle',
	};

	clearTimer(id);
	// guard against callers reusing a toast id that is currently animating out
	transient.delete(id);
	persistent.set(id, entry);
	emit();
}

function upsertTransient(id: string, input: NotificationPayload) {
	// spam damper: drop the oldest non-animating toast once over the cap
	if (transient.size >= MAX_TRANSIENT) {
		for (const oldestId of transient.keys()) {
			const oldest = transient.get(oldestId);
			if (oldest && oldest.state !== 'leaving') {
				transient.delete(oldestId);
				clearTimer(oldestId);
				break;
			}
		}
	}

	const duration = input.duration ?? DEFAULT_DURATION;
	const entry: NotificationEntry = {
		id,
		title: input.title,
		description: input.description ?? null,
		variant: input.variant ?? 'info',
		duration: duration > 0 ? duration : null,
		persistent: false,
		createdAt: Date.now(),
		state: 'idle',
	};

	clearTimer(id);
	persistent.delete(id);
	transient.set(id, entry);
	emit();

	if (duration > 0) {
		timers.set(
			id,
			setTimeout(() => removeEntry(id, true), duration),
		);
	}
}

let toastCounter = 0;

/**
 * Shows a transient status toast that auto-dismisses after its duration
 * @returns the generated entry id
 */
export function showNotification(input: NotificationPayload): string {
	const id = `toast-${(toastCounter++).toString(36)}`;
	upsertTransient(id, input);
	return id;
}

/**
 * Shows or updates a keyed, never-auto-dismissing notification (e.g. noclip).
 * Only a call to `clearPersistentNotification` removes it
 */
export function showPersistentNotification(
	id: string,
	input: NotificationPayload,
): void {
	upsertPersistent(id, input);
}

/** Clears a keyed persistent notification. No-op if nothing is keyed under `id` */
export function clearPersistentNotification(id: string): void {
	if (!persistent.has(id)) return;
	removeEntry(id, true);
}

/** Clears every keyed persistent notification */
export function clearAllPersistentNotifications(): void {
	if (persistent.size === 0) return;
	for (const id of [...persistent.keys()]) {
		removeEntry(id, true);
	}
}

/** Manually dismisses any entry (persistent or transient) */
export function dismissNotification(id: string): void {
	if (!getEntry(id)) return;
	removeEntry(id, true);
}

/**
 * Full ordered notification list, persistent entries first
 */
export function useNotifications(): NotificationEntry[] {
	return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
