use std::sync::atomic::{AtomicBool, Ordering};
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{MouseButton, TrayIconBuilder, TrayIconEvent};
use tauri::{Manager, State, WindowEvent};

struct CloseToTrayState(AtomicBool);

#[tauri::command]
fn set_close_to_tray(state: State<'_, CloseToTrayState>, enabled: bool) {
  state.0.store(enabled, Ordering::Relaxed);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(CloseToTrayState(AtomicBool::new(true)))
    .invoke_handler(tauri::generate_handler![set_close_to_tray])
    .setup(|app| {
      app.handle().plugin(
        tauri_plugin_log::Builder::default()
          .level(log::LevelFilter::Info)
          .targets([
            tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
            tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir {
              file_name: Some("totp.log".into()),
            }),
          ])
          .build(),
      )?;

      let show = MenuItemBuilder::new("Show").id("tray_show").build(app)?;
      let quit = MenuItemBuilder::new("Quit").id("tray_quit").build(app)?;
      let menu = MenuBuilder::new(app).items(&[&show, &quit]).build()?;
      let icon = app
        .default_window_icon()
        .cloned()
        .expect("default window icon not found");

      TrayIconBuilder::new()
        .icon(icon)
        .menu(&menu)
        .on_menu_event(|tray, event| {
          let app = tray.app_handle();
          match event.id().as_ref() {
            "tray_show" => {
              if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
              }
            }
            "tray_quit" => {
              app.exit(0);
            }
            _ => {}
          }
        })
        .on_tray_icon_event(|tray, event| {
          if let TrayIconEvent::Click { button, .. } = event {
            if button == MouseButton::Left {
              let app = tray.app_handle();
              if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
              }
            }
          }
        })
        .build(app)?;

      Ok(())
    })
    .on_window_event(|window, event| {
      if let WindowEvent::CloseRequested { api, .. } = event {
        let close_to_tray = window
          .state::<CloseToTrayState>()
          .0
          .load(Ordering::Relaxed);
        if close_to_tray {
          let _ = window.hide();
          api.prevent_close();
        }
      }
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
