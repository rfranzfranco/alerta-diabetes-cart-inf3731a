/**
 * VIEW: MainLayoutView.jsx
 * Disposicion principal de la aplicacion con menu lateral, soporte movil e integracion SQLite.
 */

import React, { useState } from 'react';
import { Menu, Activity } from 'lucide-react';
import { SidebarNavView } from './components/SidebarNavView';
import { TriageFormView } from './components/TriageFormView';
import { DictumCardView } from './components/DictumCardView';
import { DecisionTreeSvgView } from './components/DecisionTreeSvgView';
import { MetricsDashboardView } from './components/MetricsDashboardView';
import { ClinicalRulesTableView } from './components/ClinicalRulesTableView';
import { PatientHistoryView } from './components/PatientHistoryView';

import { useThemeViewModel } from '../viewmodels/useThemeViewModel';
import { useTriageViewModel } from '../viewmodels/useTriageViewModel';
import { useTreeViewModel } from '../viewmodels/useTreeViewModel';
import { useMetricsViewModel } from '../viewmodels/useMetricsViewModel';

export function MainLayoutView() {
  const [activeTab, setActiveTab] = useState('clinic');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { isDark, toggleTheme } = useThemeViewModel();
  const triageVM = useTriageViewModel();
  const treeVM = useTreeViewModel(triageVM.visitedNodes);
  const metricsVM = useMetricsViewModel();

  const handleLoadFromHistory = (record) => {
    triageVM.loadRecordIntoTriage(record);
    setActiveTab('clinic');
  };

  return (
    <div className="flex min-h-screen bg-base-200 text-base-content antialiased">
      {/* 1. Barra Lateral de Navegacion */}
      <SidebarNavView
        activeTab={activeTab}
        onTabChange={setActiveTab}
        presets={triageVM.presets}
        activePreset={triageVM.activePreset}
        onApplyPreset={triageVM.applyPreset}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        historyCount={triageVM.historyRecords.length}
        sensitivityPct={metricsVM.metrics.sensitivity}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* 2. Area Principal de Contenido */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Cabecera Movil */}
        <header className="lg:hidden bg-base-100 border-b border-base-300 px-4 py-3 flex items-center justify-between sticky top-0 z-30 print:hidden">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="btn btn-sm btn-ghost btn-square"
              aria-label="Abrir menú"
            >
              <Menu className="w-5 h-5" />
            </button>
            <Activity className="w-5 h-5 text-primary" />
            <span className="font-bold text-sm">Alerta Diabetes</span>
          </div>
          <span className="text-[11px] font-mono text-base-content/60">
            CART • SQLite
          </span>
        </header>

        <main className="flex-1 p-5 lg:p-8 overflow-y-auto max-w-7xl w-full mx-auto">
          {/* Pestaña 1: Consultorio y Triaje */}
          {activeTab === 'clinic' && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              <div className="xl:col-span-7 flex flex-col gap-4">
                <div>
                  <h2 className="text-base font-bold">Parámetros Fisiológicos del Paciente</h2>
                  <p className="text-xs text-base-content/60">
                    Ajuste los controles o utilice los asistentes rápidos. Si desconoce insulina o pliegue, marque &ldquo;No medido&rdquo;.
                  </p>
                </div>

                {triageVM.error && (
                  <div className="alert alert-error text-xs py-2">{triageVM.error}</div>
                )}

                <TriageFormView
                  patientValues={triageVM.patientValues}
                  unmeasuredMap={triageVM.unmeasuredMap}
                  onFeatureChange={triageVM.updateFeature}
                  onToggleUnmeasured={triageVM.toggleUnmeasured}
                  onBasicConsultMode={triageVM.applyBasicConsultMode}
                  onCalculateBmi={triageVM.applyCalculatedBmi}
                />
              </div>

              <div className="xl:col-span-5">
                <DictumCardView
                  isHighRisk={triageVM.isHighRisk}
                  probabilityPct={triageVM.probabilityPct}
                  dictum={triageVM.dictum}
                  ruleCode={triageVM.ruleCode}
                  leafNodeId={triageVM.leafNodeId}
                  ruleSummary={triageVM.ruleSummary}
                  imputedFields={triageVM.imputedFields}
                  recommendation={triageVM.clinicalRecommendation}
                  decisionSteps={triageVM.decisionSteps}
                  onSaveEvaluation={triageVM.saveToHistory}
                  savingHistory={triageVM.savingHistory}
                  onOpenHistory={() => setActiveTab('history')}
                />
              </div>
            </div>
          )}

          {/* Pestaña 2: Historial Clinico SQLite */}
          {activeTab === 'history' && (
            <PatientHistoryView
              records={triageVM.historyRecords}
              loading={triageVM.historyLoading}
              error={triageVM.historyError}
              onLoadRecord={handleLoadFromHistory}
              onDeleteRecord={triageVM.removeFromHistory}
              onRefresh={triageVM.refreshHistory}
            />
          )}

          {/* Pestaña 3: Arbol de Decision Vectorial */}
          {activeTab === 'tree' && (
            <div className="flex flex-col gap-4">
              {treeVM.error && (
                <div className="alert alert-error text-xs py-2">{treeVM.error}</div>
              )}
              <DecisionTreeSvgView
                nodes={treeVM.nodes}
                edges={treeVM.edges}
                selectedNode={treeVM.selectedNode}
                onSelectNode={treeVM.selectNode}
                loading={treeVM.loading}
              />
            </div>
          )}

          {/* Pestaña 4: Metricas y Tribunal */}
          {activeTab === 'metrics' && (
            <div className="flex flex-col gap-4">
              {metricsVM.error && (
                <div className="alert alert-error text-xs py-2">{metricsVM.error}</div>
              )}
              <MetricsDashboardView
                metrics={metricsVM.metrics}
                baseline={metricsVM.baseline}
                confusionMatrix={metricsVM.confusionMatrix}
                classificationReport={metricsVM.classificationReport}
                crossValidation={metricsVM.crossValidation}
                featureImportances={metricsVM.featureImportances}
                rocCurvePoints={metricsVM.rocCurvePoints}
                loading={metricsVM.loading}
              />
            </div>
          )}

          {/* Pestaña 5: Reglas Clinicas */}
          {activeTab === 'rules' && (
            <div className="flex flex-col gap-4">
              {metricsVM.error && (
                <div className="alert alert-error text-xs py-2">{metricsVM.error}</div>
              )}
              <ClinicalRulesTableView
                rules={metricsVM.rules}
                loading={metricsVM.loading}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
