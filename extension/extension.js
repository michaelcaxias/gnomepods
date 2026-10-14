// SPDX-License-Identifier: GPL-3.0-or-later
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import St from 'gi://St';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

const BUS = 'io.github.Explor3Universe.LinuxPods';
const PATH = '/io/github/Explor3Universe/LinuxPods';
const IFACE = 'io.github.Explor3Universe.LinuxPods.Manager';
const MODES = [['Off', 0], ['Noise Cancel', 1], ['Transparency', 2], ['Adaptive', 3]];
const POLL_SECONDS = 10;
const CALL_TIMEOUT_MS = 3000;
const BAR_WIDTH = 64;
const LOW_BATTERY = 20;

const Indicator = GObject.registerClass(
class Indicator extends PanelMenu.Button {
    _init(iconDir) {
        super._init(0.0, 'LinuxPods');
        this._destroyed = false;
        this._updating = false;
        this._props = {};
        this._iconDir = iconDir;

        this._buildPanel();
        this._buildMenu();

        this._bus = Gio.DBus.session;
        this._subs = [
            this._bus.signal_subscribe(BUS, 'org.freedesktop.DBus.Properties', 'PropertiesChanged',
                PATH, null, Gio.DBusSignalFlags.NONE, () => this._refresh()),
            this._bus.signal_subscribe(BUS, IFACE, null, PATH, null, Gio.DBusSignalFlags.NONE, () => this._refresh()),
            this._bus.signal_subscribe('org.freedesktop.DBus', 'org.freedesktop.DBus', 'NameOwnerChanged',
                '/org/freedesktop/DBus', BUS, Gio.DBusSignalFlags.NONE, () => this._refresh()),
        ];
        this._timer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, POLL_SECONDS, () => {
            this._refresh();
            return GLib.SOURCE_CONTINUE;
        });

        this._render();
        this._refresh();
    }

    _icon(name, styleClass) {
        const file = Gio.File.new_for_path(`${this._iconDir}/${name}-symbolic.svg`);
        return new St.Icon({gicon: Gio.FileIcon.new(file), style_class: styleClass});
    }

    _buildPanel() {
        const box = new St.BoxLayout({style_class: 'panel-status-menu-box'});
        this._panelIcon = this._icon('airpods', 'system-status-icon lp-panel-icon');
        box.add_child(this._panelIcon);
        this._panelLabel = new St.Label({y_align: Clutter.ActorAlign.CENTER, text: ''});
        box.add_child(this._panelLabel);
        this.add_child(box);
    }

    _buildMenu() {
        // Header: icon, device name, status line.
        const header = new PopupMenu.PopupBaseMenuItem({reactive: false, can_focus: false});
        const hbox = new St.BoxLayout({style_class: 'lp-header', x_expand: true});
        hbox.add_child(this._icon('airpods', 'lp-header-icon'));
        const titles = new St.BoxLayout({vertical: true, y_align: Clutter.ActorAlign.CENTER});
        this._title = new St.Label({style_class: 'lp-title', text: 'AirPods'});
        this._subtitle = new St.Label({style_class: 'lp-subtitle', text: ''});
        titles.add_child(this._title);
        titles.add_child(this._subtitle);
        hbox.add_child(titles);
        header.add_child(hbox);
        this.menu.addMenuItem(header);

        // Battery tiles: left bud, case, right bud.
        const tilesItem = new PopupMenu.PopupBaseMenuItem({reactive: false, can_focus: false});
        const tiles = new St.BoxLayout({style_class: 'lp-tiles', x_expand: true, x_align: Clutter.ActorAlign.CENTER});
        this._tiles = {
            Left: this._makeTile('bud-left', 'Left'),
            Case: this._makeTile('airpods-case', 'Case'),
            Right: this._makeTile('bud-right', 'Right'),
        };
        for (const t of Object.values(this._tiles)) tiles.add_child(t.actor);
        tilesItem.add_child(tiles);
        this.menu.addMenuItem(tilesItem);

        // Noise control segmented buttons.
        const sec = new PopupMenu.PopupBaseMenuItem({reactive: false, can_focus: false});
        sec.add_child(new St.Label({style_class: 'lp-section', text: 'NOISE CONTROL'}));
        this.menu.addMenuItem(sec);

        const modesItem = new PopupMenu.PopupBaseMenuItem({reactive: false, can_focus: false});
        const modes = new St.BoxLayout({style_class: 'lp-modes', x_expand: true, x_align: Clutter.ActorAlign.CENTER});
        this._modeButtons = MODES.map(([label, id]) => {
            const b = new St.Button({style_class: 'lp-mode', label, can_focus: true});
            b.connect('clicked', () => this._setMode(id));
            modes.add_child(b);
            return b;
        });
        modesItem.add_child(modes);
        this.menu.addMenuItem(modesItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._ca = this._makeSwitch('Conversational Awareness', 'SetConversationalAwareness');
        this._oneBud = this._makeSwitch('One Bud ANC', 'SetOneBudANCMode');
    }

    _makeSwitch(label, method) {
        const item = new PopupMenu.PopupSwitchMenuItem(label, false);
        item.connect('toggled', (_i, state) => {
            if (!this._updating) this._call(method, new GLib.Variant('(b)', [state]));
        });
        this.menu.addMenuItem(item);
        return item;
    }

    _makeTile(iconName, name) {
        const actor = new St.BoxLayout({style_class: 'lp-tile', vertical: true});
        const center = {x_align: Clutter.ActorAlign.CENTER};
        const icon = this._icon(iconName, 'lp-tile-icon');
        icon.set(center);
        const pct = new St.Label({style_class: 'lp-tile-pct', text: '–', ...center});
        const bar = new St.Widget({style_class: 'lp-bar', layout_manager: new Clutter.BinLayout(), ...center});
        bar.set_width(BAR_WIDTH);
        const fill = new St.Widget({style_class: 'lp-bar-fill', x_align: Clutter.ActorAlign.START});
        fill.set_width(0);
        bar.add_child(fill);
        const label = new St.Label({style_class: 'lp-tile-name', text: name, ...center});
        for (const w of [icon, pct, bar, label]) actor.add_child(w);
        return {actor, pct, fill, label, name};
    }

    _refresh() {
        if (this._destroyed) return;
        this._bus.call(BUS, PATH, 'org.freedesktop.DBus.Properties', 'GetAll',
            new GLib.Variant('(s)', [IFACE]), new GLib.VariantType('(a{sv})'),
            Gio.DBusCallFlags.NO_AUTO_START, CALL_TIMEOUT_MS, null, (_c, res) => {
                if (this._destroyed) return;
                try {
                    const [dict] = this._bus.call_finish(res).deepUnpack();
                    const props = {};
                    for (const k in dict) props[k] = dict[k].deepUnpack();
                    this._props = props;
                } catch (_e) {
                    this._props = {};
                }
                this._render();
            });
    }

    _call(method, params) {
        this._bus.call(BUS, PATH, IFACE, method, params, null,
            Gio.DBusCallFlags.NO_AUTO_START, CALL_TIMEOUT_MS, null, (_c, res) => {
                try { this._bus.call_finish(res); } catch (e) { logError(e); }
                this._refresh();
            });
    }

    _setMode(id) {
        this._call('SetNoiseControlMode', new GLib.Variant('(i)', [id]));
    }

    _renderTile(key, available, level, charging, inEar) {
        const t = this._tiles[key];
        t.actor.remove_style_class_name('lp-tile-off');
        if (!available) t.actor.add_style_class_name('lp-tile-off');
        t.pct.text = available ? `${level}%${charging ? ' ⚡' : ''}` : '–';
        t.fill.set_width(available ? Math.round(BAR_WIDTH * Math.min(level, 100) / 100) : 0);
        t.fill.remove_style_class_name('lp-low');
        t.fill.remove_style_class_name('lp-charging');
        if (available && charging) t.fill.add_style_class_name('lp-charging');
        else if (available && level <= LOW_BATTERY) t.fill.add_style_class_name('lp-low');
        t.label.text = inEar === undefined ? t.name : `${t.name} · ${inEar ? 'in ear' : 'out'}`;
    }

    _render() {
        if (this._destroyed) return;
        const p = this._props;
        const connected = !!p.Connected;

        this._panelIcon.opacity = connected ? 255 : 110;
        this._title.text = p.DeviceName ?? 'AirPods';
        const modeName = MODES.find(([, id]) => id === p.NoiseControlMode)?.[0];
        this._subtitle.text = connected ? `Connected${modeName ? ` · ${modeName}` : ''}` : 'Disconnected';

        this._renderTile('Left', connected && p.LeftBatteryAvailable, p.LeftBatteryLevel, p.LeftBatteryCharging, p.LeftPodInEar);
        this._renderTile('Right', connected && p.RightBatteryAvailable, p.RightBatteryLevel, p.RightBatteryCharging, p.RightPodInEar);
        this._renderTile('Case', connected && p.CaseBatteryAvailable, p.CaseBatteryLevel, p.CaseBatteryCharging);

        this._modeButtons.forEach((b, i) => {
            b.reactive = connected;
            b.opacity = connected ? 255 : 100;
            if (connected && MODES[i][1] === p.NoiseControlMode) b.add_style_class_name('lp-active');
            else b.remove_style_class_name('lp-active');
        });

        this._updating = true;
        this._ca.setToggleState(!!p.ConversationalAwareness);
        this._oneBud.setToggleState(!!p.OneBudANCMode);
        this._ca.setSensitive(connected);
        this._oneBud.setSensitive(connected);
        this._updating = false;

        const levels = ['Left', 'Right', 'Headset'].filter(n => connected && p[`${n}BatteryAvailable`])
            .map(n => p[`${n}BatteryLevel`]);
        this._panelLabel.text = levels.length ? ` ${Math.min(...levels)}%` : '';
    }

    destroy() {
        this._destroyed = true;
        if (this._timer) GLib.source_remove(this._timer);
        this._timer = 0;
        this._subs?.forEach(id => this._bus.signal_unsubscribe(id));
        this._subs = [];
        super.destroy();
    }
});

export default class LinuxPodsExtension extends Extension {
    enable() {
        this._indicator = new Indicator(`${this.path}/icons`);
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }

    disable() {
        this._indicator?.destroy();
        this._indicator = null;
    }
}
