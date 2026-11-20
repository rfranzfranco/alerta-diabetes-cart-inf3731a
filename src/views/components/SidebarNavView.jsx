/**
 * VIEW: SidebarNavView.jsx
 * Barra lateral responsiva con sigla INF-3731A, acceso al historial SQLite, casos y tema.
 */

import React from 'react';
import {
  Stethoscope,
  Network,
  BarChart3,
  FileCode2,
  Database,
  Sun,
  Moon,
  ShieldAlert,
  UserCheck,
  AlertTriangle,
  AlertOctagon,
  Activity,
  X
} from 'lucide-react';

export function SidebarNavView({
  activeTab,
  onTabChange,
  presets,
  activePreset,
  onApplyPreset,
  isDark,
  onToggleTheme,
  historyCount = 0,
  sensitivityPct = '74.63',
  mobileOpen = false,
  onCloseMobile
}) {
  const navItems = [
    { id: 'clinic', label: 'Consultorio y Triaje', icon: Stethoscope },
    { id: 'history', label: 'Historial Clínico (BD)', icon: Database, badge: historyCount },
    { id: 'tree', label: 'Árbol de Decisión', icon: Network },
    { id: 'metrics', label: 'Métricas', icon: BarChart3 },
    { id: 'rules', label: 'Reglas Clínicas (R1–R8)', icon: FileCode2 },
  ];

  const presetIcons = {
    asymptomatic: UserCheck,
    undiagnosed_r4: ShieldAlert,
    borderline_r6: AlertTriangle,
    hyperglycemia: AlertOctagon,
  };

  const handleNavClick = (id) => {
    onTabChange(id);
    if (onCloseMobile) onCloseMobile();
  };

  const handlePresetClick = (id) => {
    onApplyPreset(id);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden print:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-80 bg-base-100 border-r border-base-300 flex flex-col justify-between shrink-0 h-screen lg:sticky lg:top-0 p-5 shadow-sm overflow-y-auto transition-transform duration-200 print:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex flex-col gap-5">
          {/* Cabecera */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary text-primary-content rounded-xl shadow-md">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <h1 className="font-bold text-base leading-tight">Alerta Diabetes</h1>
                <p className="text-xs text-base-content/60 mt-0.5">Triaje CART • API + SQLite</p>
              </div>
            </div>
            {onCloseMobile && (
              <button
                type="button"
                onClick={onCloseMobile}
                className="btn btn-sm btn-ghost btn-circle lg:hidden"
                aria-label="Cerrar menú"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Menu de Modulos */}
          <div>
            <span className="text-[11px] font-semibold tracking-wider uppercase text-base-content/50 px-2">
              Módulos del Sistema
            </span>
            <ul className="menu menu-sm gap-1 mt-2 p-0">
              {navItems.map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => handleNavClick(item.id)}
                      className={`flex items-center justify-between py-2.5 px-3 rounded-lg transition-all ${
                        isActive
                          ? 'active font-semibold shadow-sm'
                          : 'hover:bg-base-200 text-base-content/80'
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <Icon className="w-4 h-4 shrink-0" />
                        <span>{item.label}</span>
                      </span>
                      {typeof item.badge === 'number' && (
                        <span className="badge badge-xs badge-primary font-mono">{item.badge}</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Casos Clinicos Predefinidos */}
          <div className="pt-2 border-t border-base-200">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-base-content/50 px-2">
              Casos Clínicos Rápidos
            </span>
            <div className="flex flex-col gap-1.5 mt-2">
              {presets.map(p => {
                const Icon = presetIcons[p.id] || UserCheck;
                const isSelected = activePreset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handlePresetClick(p.id)}
                    className={`text-left p-2.5 rounded-lg border text-xs transition-all ${
                      isSelected
                        ? 'bg-base-200 border-primary shadow-sm font-medium'
                        : 'border-base-200 hover:border-base-300 hover:bg-base-200/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold flex items-center gap-1.5">
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <span>{p.label}</span>
                      </span>
                      <span className={`badge badge-xs shrink-0 ${p.badgeClass}`}></span>
                    </div>
                    <p className="text-[11px] text-base-content/60 mt-1 line-clamp-2">
                      {p.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Pie de Barra Lateral */}
        <div className="pt-4 mt-4 border-t border-base-200 flex flex-col gap-3">
          <div className="flex items-center justify-between px-2">
            <span className="text-xs text-base-content/70">Tema de Interfaz</span>
            <button
              type="button"
              onClick={onToggleTheme}
              className="btn btn-sm btn-ghost btn-circle"
              title="Cambiar tema claro / oscuro"
            >
              {isDark ? <Sun className="w-4 h-4 text-warning" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>

          <div className="bg-base-200/70 p-2.5 rounded-lg text-[11px] text-base-content/70 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-primary shrink-0" />
            <span>CART Podado (max_depth = 3) • Sensibilidad {sensitivityPct}% • SQLite.</span>
          </div>
        </div>
      </aside>
    </>
  );
}
