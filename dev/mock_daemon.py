#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Fake linuxpods-daemon for testing the GNOME extension in a nested shell.

Claims io.github.Explor3Universe.LinuxPods on the session bus and serves fixed
properties. SetNoiseControlMode works so the menu can be exercised.
"""
import gi
gi.require_version("Gio", "2.0")
from gi.repository import Gio, GLib

BUS = "io.github.Explor3Universe.LinuxPods"
PATH = "/io/github/Explor3Universe/LinuxPods"
IFACE = BUS + ".Manager"
XML = f"""<node><interface name="{IFACE}">
  <method name="SetNoiseControlMode"><arg type="i" direction="in"/></method>
  <method name="SetConversationalAwareness"><arg type="b" direction="in"/></method>
  <method name="SetOneBudANCMode"><arg type="b" direction="in"/></method>
  <property name="ConversationalAwareness" type="b" access="read"/>
  <property name="OneBudANCMode" type="b" access="read"/>
  <property name="LeftPodInEar" type="b" access="read"/>
  <property name="RightPodInEar" type="b" access="read"/>
  <property name="Connected" type="b" access="read"/>
  <property name="DeviceName" type="s" access="read"/>
  <property name="NoiseControlMode" type="i" access="read"/>
  <property name="LeftBatteryAvailable" type="b" access="read"/>
  <property name="LeftBatteryLevel" type="y" access="read"/>
  <property name="LeftBatteryCharging" type="b" access="read"/>
  <property name="RightBatteryAvailable" type="b" access="read"/>
  <property name="RightBatteryLevel" type="y" access="read"/>
  <property name="RightBatteryCharging" type="b" access="read"/>
  <property name="CaseBatteryAvailable" type="b" access="read"/>
  <property name="CaseBatteryLevel" type="y" access="read"/>
  <property name="CaseBatteryCharging" type="b" access="read"/>
  <property name="HeadsetBatteryAvailable" type="b" access="read"/>
  <property name="HeadsetBatteryLevel" type="y" access="read"/>
  <property name="HeadsetBatteryCharging" type="b" access="read"/>
</interface></node>"""

state = {
    "ConversationalAwareness": ("b", False), "OneBudANCMode": ("b", False),
    "LeftPodInEar": ("b", True), "RightPodInEar": ("b", False),
    "Connected": ("b", True), "DeviceName": ("s", "AirPods Pro"), "NoiseControlMode": ("i", 2),
    "LeftBatteryAvailable": ("b", True), "LeftBatteryLevel": ("y", 55), "LeftBatteryCharging": ("b", False),
    "RightBatteryAvailable": ("b", True), "RightBatteryLevel": ("y", 54), "RightBatteryCharging": ("b", False),
    "CaseBatteryAvailable": ("b", True), "CaseBatteryLevel": ("y", 80), "CaseBatteryCharging": ("b", True),
    "HeadsetBatteryAvailable": ("b", False), "HeadsetBatteryLevel": ("y", 0), "HeadsetBatteryCharging": ("b", False),
}

def get_property(_c, _s, _p, _i, name):
    t, v = state[name]
    return GLib.Variant(t, v)

def method_call(_c, _s, _p, _i, method, params, inv):
    keys = {"SetNoiseControlMode": "NoiseControlMode",
            "SetConversationalAwareness": "ConversationalAwareness",
            "SetOneBudANCMode": "OneBudANCMode"}
    if method in keys:
        k = keys[method]
        state[k] = (state[k][0], params.unpack()[0])
        inv.return_value(None)

def on_bus(conn, _name):
    node = Gio.DBusNodeInfo.new_for_xml(XML)
    conn.register_object(PATH, node.interfaces[0], method_call, get_property, None)

Gio.bus_own_name(Gio.BusType.SESSION, BUS, Gio.BusNameOwnerFlags.NONE, on_bus, None, None)
GLib.MainLoop().run()
