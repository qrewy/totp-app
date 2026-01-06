import React, { createContext, useCallback, useContext, useMemo, useState } from "react"

type Locale = "en" | "ru"

type Dictionary = Record<string, string>

const STORAGE_KEY = "totp_locale"

const translations: Record<Locale, Dictionary> = {
  en: {
    "app.title": "totp app",
    "actions.close": "Close",
    "actions.add": "Add",
    "actions.save": "Save",
    "actions.cancel": "Cancel",
    "actions.delete": "Delete",
    "actions.rename": "Rename",
    "actions.lock": "Lock",
    "actions.set_pin": "Set PIN",
    "actions.change_pin": "Change PIN",
    "actions.remove_pin": "Remove PIN",
    "actions.unlock": "Unlock",
    "actions.export_selected": "Download TXT",
    "actions.download_qr": "Download QR",
    "actions.export_all": "Export all",
    "actions.minimize": "Minimize",
    "actions.settings": "Settings",
    "actions.scan_qr": "Scan QR",
    "empty.title": "No codes yet",
    "empty.search": "No matches found",
    "search.placeholder": "Search",
    "modal.add.title": "Add TOTP",
    "modal.add.name": "Name",
    "modal.add.secret": "Secret",
    "modal.add.placeholder.name": "GitHub",
    "modal.add.placeholder.secret": "JBSWY3DPEHPK3PXP",
    "modal.rename.title": "Rename TOTP",
    "modal.rename.placeholder.name": "New name",
    "modal.delete.title": "Delete TOTP",
    "modal.delete.confirm": "Delete \"{name}\"?",
    "menu.rename": "Rename",
    "menu.delete": "Delete",
    "menu.export": "Export",
    "export.title": "Export QR",
    "export.selected": "{count} selected",
    "export.none": "Nothing selected",
    "export.select_all": "Select all",
    "export.deselect_all": "Deselect all",
    "export.batch": "Batch {index}/{total}",
    "export.empty_qr": "Select items to generate QR codes",
    "settings.title": "Settings",
    "settings.export": "Export",
    "settings.pin": "PIN",
    "settings.blur_codes": "Blur codes",
    "settings.blur_codes.on": "On",
    "settings.blur_codes.off": "Off",
    "settings.close_to_tray": "Close to tray",
    "settings.period": "Period",
    "settings.theme": "Theme",
    "settings.theme.default": "Default",
    "settings.clipboard": "Clipboard",
    "settings.clipboard.enabled": "Auto-copy enabled",
    "settings.language": "Language",
    "settings.language.en": "English",
    "settings.language.ru": "Russian",
    "toast.copied": "Copied",
    "toast.copy_failed": "Copy failed",
    "toast.fill_all": "Fill all fields",
    "toast.invalid_secret": "Invalid secret",
    "toast.added": "Added",
    "toast.renamed": "Renamed",
    "toast.deleted": "Deleted",
    "toast.exported": "Exported",
    "toast.export_empty": "Nothing to export",
    "toast.export_failed": "Export failed",
    "toast.pin_set": "PIN set",
    "toast.pin_removed": "PIN removed",
    "toast.pin_unlocked": "Unlocked",
    "toast.enter_name": "Enter a name",
    "toast.scan_loaded": "QR added",
    "pin.enter_title": "Enter PIN",
    "pin.set_title": "Set a PIN",
    "pin.confirm_title": "Confirm PIN",
    "pin.placeholder": "••••",
    "pin.error_invalid": "Incorrect PIN",
    "pin.error_short": "PIN must be at least 4 digits",
    "pin.error_mismatch": "PINs do not match",
    "pin.locked_hint": "App locked due to inactivity",
    "scan.drop": "Drag an image here.",
    "scan.paste": "Or press Ctrl+V to paste.",
    "scan.processing": "Scanning...",
    "scan.no_qr": "QR code not found",
    "scan.invalid": "Invalid QR image",
  },
  ru: {
    "app.title": "totp app",
    "actions.close": "Закрыть",
    "actions.add": "Добавить",
    "actions.save": "Сохранить",
    "actions.cancel": "Отмена",
    "actions.delete": "Удалить",
    "actions.rename": "Переименовать",
    "actions.lock": "Заблокировать",
    "actions.set_pin": "Установить PIN",
    "actions.change_pin": "Сменить PIN",
    "actions.remove_pin": "Удалить PIN",
    "actions.unlock": "Разблокировать",
    "actions.export_selected": "Скачать TXT",
    "actions.download_qr": "Скачать QR",
    "actions.export_all": "Экспортировать все",
    "actions.minimize": "Свернуть",
    "actions.settings": "Настройки",
    "actions.scan_qr": "Сканировать QR",
    "empty.title": "Пока нет кодов",
    "empty.search": "Ничего не найдено",
    "search.placeholder": "Поиск",
    "modal.add.title": "Добавить TOTP",
    "modal.add.name": "Название",
    "modal.add.secret": "Секрет",
    "modal.add.placeholder.name": "GitHub",
    "modal.add.placeholder.secret": "JBSWY3DPEHPK3PXP",
    "modal.rename.title": "Переименовать",
    "modal.rename.placeholder.name": "Новое название",
    "modal.delete.title": "Удалить TOTP",
    "modal.delete.confirm": "Удалить \"{name}\"?",
    "menu.rename": "Переименовать",
    "menu.delete": "Удалить",
    "menu.export": "Экспорт",
    "export.title": "Экспорт QR",
    "export.selected": "Выбрано: {count}",
    "export.none": "Ничего не выбрано",
    "export.select_all": "Выбрать все",
    "export.deselect_all": "Снять выбор",
    "export.batch": "Пакет {index}/{total}",
    "export.empty_qr": "Выберите элементы для QR",
    "settings.title": "Настройки",
    "settings.export": "Экспорт",
    "settings.pin": "PIN",
    "settings.blur_codes": "Размывать коды",
    "settings.blur_codes.on": "Вкл",
    "settings.blur_codes.off": "Выкл",
    "settings.close_to_tray": "Закрывать в трей",
    "settings.period": "Период",
    "settings.theme": "Тема",
    "settings.theme.default": "По умолчанию",
    "settings.clipboard": "Буфер обмена",
    "settings.clipboard.enabled": "Автокопирование включено",
    "settings.language": "Язык",
    "settings.language.en": "English",
    "settings.language.ru": "Русский",
    "toast.copied": "Скопировано",
    "toast.copy_failed": "Не удалось скопировать",
    "toast.fill_all": "Заполните все поля",
    "toast.invalid_secret": "Неверный секрет",
    "toast.added": "Добавлено",
    "toast.renamed": "Переименовано",
    "toast.deleted": "Удалено",
    "toast.exported": "Экспортировано",
    "toast.export_empty": "Нечего экспортировать",
    "toast.export_failed": "Ошибка экспорта",
    "toast.pin_set": "PIN установлен",
    "toast.pin_removed": "PIN удален",
    "toast.pin_unlocked": "Разблокировано",
    "toast.enter_name": "Введите название",
    "toast.scan_loaded": "QR добавлен",
    "pin.enter_title": "Введите PIN",
    "pin.set_title": "Установите PIN",
    "pin.confirm_title": "Подтвердите PIN",
    "pin.placeholder": "••••",
    "pin.error_invalid": "Неверный PIN",
    "pin.error_short": "PIN минимум 4 цифры",
    "pin.error_mismatch": "PIN не совпадает",
    "pin.locked_hint": "Приложение заблокировано из-за бездействия",
    "scan.drop": "Перетащите изображение сюда.",
    "scan.paste": "Или нажмите Ctrl+V для вставки.",
    "scan.processing": "Сканирование...",
    "scan.no_qr": "QR код не найден",
    "scan.invalid": "Неверное изображение QR",
  },
}

type I18nContextValue = {
  locale: Locale
  setLocale: (value: Locale) => void
  t: (key: string, params?: Record<string, string>) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

function getInitialLocale(): Locale {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === "ru" || stored === "en") {
    return stored
  }
  if (typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("ru")) {
    return "ru"
  }
  return "en"
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale)

  const setLocale = useCallback((value: Locale) => {
    setLocaleState(value)
    localStorage.setItem(STORAGE_KEY, value)
  }, [])

  const t = useCallback(
    (key: string, params?: Record<string, string>) => {
      const dict = translations[locale] ?? translations.en
      const fallback = translations.en[key] ?? key
      const template = dict[key] ?? fallback
      if (!params) {
        return template
      }
      return Object.entries(params).reduce(
        (result, [token, value]) => result.replaceAll(`{${token}}`, value),
        template,
      )
    },
    [locale],
  )

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider")
  }
  return ctx
}
