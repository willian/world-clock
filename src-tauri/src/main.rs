use core_graphics::{
    display::CGDisplay,
    event::CGEvent,
    event_source::{CGEventSource, CGEventSourceStateID},
};
use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};
use tauri::{
    AppHandle, LogicalPosition, LogicalSize, Manager, PhysicalPosition, Position, Rect as TrayRect,
    WebviewWindow,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};

const PANEL_HEIGHT: f64 = 340.0;
const PANEL_WIDTH: f64 = 520.0;
const PANEL_GAP: f64 = 8.0;

#[derive(Deserialize)]
struct ItemQuery {
    bounding_rects: std::collections::BTreeMap<String, QueryRect>,
}

#[derive(Deserialize)]
struct QueryRect {
    origin: [f64; 2],
    size: [f64; 2],
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct City {
    country: String,
    iana_timezone: String,
    latitude: f64,
    locale: String,
    longitude: f64,
    name: String,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
enum Appearance {
    Dark,
    Light,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct Settings {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    appearance: Option<Appearance>,
    #[serde(default = "show_menu_bar_by_default")]
    show_menu_bar: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            appearance: None,
            show_menu_bar: true,
        }
    }
}

fn show_menu_bar_by_default() -> bool {
    true
}

fn config_file(app: &AppHandle, name: &str) -> Result<PathBuf, String> {
    let directory = app
        .path()
        .app_config_dir()
        .map_err(|error| error.to_string())?;
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    Ok(directory.join(name))
}

fn cities_file(app: &AppHandle) -> Result<PathBuf, String> {
    config_file(app, "cities.json")
}

fn home_file(app: &AppHandle) -> Result<PathBuf, String> {
    config_file(app, "home-city.json")
}

fn settings_file(app: &AppHandle) -> Result<PathBuf, String> {
    config_file(app, "settings.json")
}

fn migrate_sketchybar_data(app: &AppHandle) {
    let Ok(directory) = app.path().app_config_dir() else {
        return;
    };
    let Some(parent) = directory.parent() else {
        return;
    };
    let legacy = parent.join("com.willian.sketchybar-world-clock");
    for name in ["cities.json", "home-city.json"] {
        let destination = directory.join(name);
        let source = legacy.join(name);
        if !destination.exists() && source.exists() {
            let _ = fs::copy(source, destination);
        }
    }
}

fn save_json<T: Serialize>(file: PathBuf, value: &T) -> Result<(), String> {
    let temporary = file.with_extension("tmp");
    let contents = serde_json::to_vec_pretty(value).map_err(|error| error.to_string())?;
    fs::write(&temporary, contents).map_err(|error| error.to_string())?;
    fs::rename(temporary, file).map_err(|error| error.to_string())
}

#[tauri::command]
fn load_cities(app: AppHandle) -> Result<Option<Vec<City>>, String> {
    let file = cities_file(&app)?;
    if !file.exists() {
        return Ok(None);
    }
    let contents = fs::read_to_string(file).map_err(|error| error.to_string())?;
    serde_json::from_str(&contents)
        .map(Some)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn save_cities(app: AppHandle, cities: Vec<City>) -> Result<(), String> {
    save_json(cities_file(&app)?, &cities)
}

#[tauri::command]
fn load_home_city(app: AppHandle) -> Result<Option<City>, String> {
    let file = home_file(&app)?;
    if !file.exists() {
        return Ok(None);
    }
    let contents = fs::read_to_string(file).map_err(|error| error.to_string())?;
    serde_json::from_str(&contents)
        .map(Some)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn save_home_city(app: AppHandle, city: City) -> Result<(), String> {
    save_json(home_file(&app)?, &city)
}

#[tauri::command]
fn load_settings(app: AppHandle) -> Result<Settings, String> {
    let file = settings_file(&app)?;
    if !file.exists() {
        return Ok(Settings::default());
    }
    let contents = fs::read_to_string(file).map_err(|error| error.to_string())?;
    serde_json::from_str(&contents).map_err(|error| error.to_string())
}

#[tauri::command]
fn save_settings(
    app: AppHandle,
    appearance: Option<Appearance>,
    show_menu_bar: bool,
) -> Result<(), String> {
    save_json(
        settings_file(&app)?,
        &Settings {
            appearance,
            show_menu_bar,
        },
    )?;
    if let Some(tray) = app.tray_by_id("menu-bar") {
        tray.set_visible(show_menu_bar)
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn resize_panel(window: WebviewWindow, height: f64) -> Result<(), String> {
    window
        .set_size(LogicalSize::new(PANEL_WIDTH, height))
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn hide_panel(window: WebviewWindow) -> Result<(), String> {
    window.hide().map_err(|error| error.to_string())
}

fn cursor_position() -> Option<(f64, f64)> {
    let source = CGEventSource::new(CGEventSourceStateID::HIDSystemState).ok()?;
    let event = CGEvent::new(source).ok()?;
    let point = event.location();
    Some((point.x, point.y))
}

fn position_for_clock(query: &ItemQuery) -> Option<LogicalPosition<f64>> {
    let (cursor_x, cursor_y) = cursor_position()?;
    let item = query
        .bounding_rects
        .values()
        .find(|rect| {
            cursor_x >= rect.origin[0]
                && cursor_x <= rect.origin[0] + rect.size[0]
                && cursor_y >= rect.origin[1]
                && cursor_y <= rect.origin[1] + rect.size[1]
        })
        .or_else(|| query.bounding_rects.values().next())?;
    let display_id = CGDisplay::displays_with_point(
        core_graphics::geometry::CGPoint::new(cursor_x, cursor_y),
        1,
    )
    .ok()?
    .0
    .into_iter()
    .next()?;
    let display = CGDisplay::new(display_id).bounds();
    let x = (item.origin[0] + item.size[0] / 2.0 - PANEL_WIDTH / 2.0).clamp(
        display.origin.x,
        display.origin.x + display.size.width - PANEL_WIDTH,
    );
    let y = (item.origin[1] + item.size[1] + PANEL_GAP).clamp(
        display.origin.y,
        display.origin.y + display.size.height - PANEL_HEIGHT,
    );
    Some(LogicalPosition::new(x, y))
}

fn position_for_tray(app: &AppHandle, rect: TrayRect) -> Option<PhysicalPosition<i32>> {
    let position = rect.position.to_physical::<f64>(1.0);
    let size = rect.size.to_physical::<f64>(1.0);
    let center_x = position.x + size.width / 2.0;
    let bottom_y = position.y + size.height;
    let monitor = app.available_monitors().ok()?.into_iter().find(|monitor| {
        let position = monitor.position();
        let size = monitor.size();
        center_x >= f64::from(position.x)
            && center_x <= f64::from(position.x) + f64::from(size.width)
            && bottom_y >= f64::from(position.y)
            && bottom_y <= f64::from(position.y) + f64::from(size.height)
    })?;
    let position = monitor.position();
    let size = monitor.size();
    let panel_width = PANEL_WIDTH * monitor.scale_factor();
    let x = (center_x - panel_width / 2.0).clamp(
        f64::from(position.x),
        f64::from(position.x) + f64::from(size.width) - panel_width,
    );
    Some(PhysicalPosition::new(
        x.round() as i32,
        (bottom_y + PANEL_GAP * monitor.scale_factor()).round() as i32,
    ))
}

fn toggle_panel(app: &AppHandle, position: Option<Position>) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    if window.is_visible().unwrap_or(false) {
        let _ = window.hide();
        return;
    }
    if let Some(position) = position {
        let _ = window.set_position(position);
    }
    let _ = window.show();
    let _ = window.set_focus();
}

fn toggle_from_clock(app: &AppHandle, query: &str) {
    let position = serde_json::from_str::<ItemQuery>(query)
        .ok()
        .and_then(|query| position_for_clock(&query))
        .map(Position::Logical);
    toggle_panel(app, position);
}

fn toggle_args(args: &[String]) -> Option<&str> {
    args.windows(2)
        .find(|pair| pair[0] == "--toggle")
        .map(|pair| pair[1].as_str())
}

fn main() {
    let args = std::env::args().collect::<Vec<_>>();
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, _| {
            if let Some(query) = toggle_args(&args) {
                toggle_from_clock(app, query);
            } else {
                toggle_panel(app, None);
            }
        }))
        .setup(move |app| {
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            app.set_dock_visibility(false);
            migrate_sketchybar_data(app.handle());
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&quit])?;
            let settings = load_settings(app.handle().clone()).unwrap_or_default();
            let tray = TrayIconBuilder::with_id("menu-bar")
                .icon(tauri::image::Image::from_bytes(include_bytes!(
                    "../tray-icons/32x32.png"
                ))?)
                .icon_as_template(true)
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| {
                    if event.id.as_ref() == "quit" {
                        app.exit(0);
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        rect,
                        ..
                    } = event
                    {
                        toggle_panel(
                            tray.app_handle(),
                            position_for_tray(tray.app_handle(), rect).map(Position::Physical),
                        );
                    }
                })
                .build(app)?;
            tray.set_visible(settings.show_menu_bar)?;
            if let Some(query) = toggle_args(&args) {
                toggle_from_clock(app.handle(), query);
            } else {
                toggle_panel(app.handle(), None);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            hide_panel,
            load_cities,
            load_home_city,
            load_settings,
            resize_panel,
            save_cities,
            save_home_city,
            save_settings
        ])
        .run(tauri::generate_context!())
        .expect("error while running World Clock");
}
