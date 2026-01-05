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
    "actions.minimize": "Minimize",
    "actions.settings": "Settings",
    "actions.scan_qr": "Scan QR",
    "empty.title": "No codes yet",
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
    "settings.title": "Settings",
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
    "toast.enter_name": "Enter a name",
    "toast.scan_loaded": "QR added",
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
    "actions.minimize": "Свернуть",
    "actions.settings": "Настройки",
    "actions.scan_qr": "Сканировать QR",
    "empty.title": "Пока нет кодов",
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
    "settings.title": "Настройки",
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
    "toast.enter_name": "Введите название",
    "toast.scan_loaded": "QR добавлен",
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
