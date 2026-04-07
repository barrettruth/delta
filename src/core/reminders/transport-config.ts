import {
  deleteSystemConfig,
  getSystemConfig,
  setSystemConfig,
} from "@/core/system-config";
import type { Db } from "@/core/types";
import {
  getEmptyReminderTransportConfigStatus,
  getReminderTransportFields,
  REMINDER_TRANSPORT_CONFIGURABLE_ADAPTER_KEYS,
  type ReminderTransportConfigStatus,
  type ReminderTransportConfigurableAdapterKey,
} from "@/lib/reminder-transport-form";

export function getReminderTransportConfigStatus(
  db: Db,
  adapterKey: ReminderTransportConfigurableAdapterKey,
): ReminderTransportConfigStatus {
  const fields = getReminderTransportFields(adapterKey);
  const missingFields = fields
    .filter((field) => !getSystemConfig(db, field.systemConfigKey))
    .map((field) => field.name);

  return {
    adapterKey,
    configured: missingFields.length === 0,
    missingFields,
  };
}

export function listReminderTransportConfigStatuses(
  db: Db,
): ReminderTransportConfigStatus[] {
  return REMINDER_TRANSPORT_CONFIGURABLE_ADAPTER_KEYS.map((adapterKey) =>
    getReminderTransportConfigStatus(db, adapterKey),
  );
}

export function setReminderTransportConfig(
  db: Db,
  adapterKey: ReminderTransportConfigurableAdapterKey,
  values: Record<string, string>,
): ReminderTransportConfigStatus {
  for (const field of getReminderTransportFields(adapterKey)) {
    const value = values[field.name];
    if (!value?.trim()) {
      throw new Error(`${field.label} is required`);
    }
    setSystemConfig(db, field.systemConfigKey, value.trim());
  }

  return getReminderTransportConfigStatus(db, adapterKey);
}

export function deleteReminderTransportConfig(
  db: Db,
  adapterKey: ReminderTransportConfigurableAdapterKey,
): { deleted: boolean; status: ReminderTransportConfigStatus } {
  const deleted = getReminderTransportFields(adapterKey)
    .map((field) => deleteSystemConfig(db, field.systemConfigKey))
    .some(Boolean);

  return {
    deleted,
    status: deleted
      ? getReminderTransportConfigStatus(db, adapterKey)
      : getEmptyReminderTransportConfigStatus(adapterKey),
  };
}
