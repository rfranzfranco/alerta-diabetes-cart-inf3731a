/**
 * VIEW: DecisionTreeSvgView.jsx
 * Grafo jerarquico interactivo SVG del arbol podado con iluminacion de la ruta activa en tiempo real.
 */

import React from 'react';
import { Network, Info } from 'lucide-react';
import { FEATURE_METADATA } from '../../models/PatientModel';

export function DecisionTreeSvgView({
  nodes,
  edges,
  selectedNode,
  onSelectNode,
  loading
}) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 gap-3 text-base-content/60">
        <span className="loading loading-spinner loading-md text-primary"></span>
        <span className="text-xs">Cargando topología vectorial del árbol...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Contenedor SVG y Leyenda */}
      <div className="bg-base-100 p-5 rounded-2xl border border-base-200 shadow-sm flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Network className="w-5 h-5 text-primary" />
            <div>
              <h2 className="text-sm font-bold">Topología del Árbol de Decisión (CART Podado)</h2>
              <p className="text-xs text-base-content/60">
                La rama activa correspondiente al paciente actual se ilumina en tiempo real.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-primary shadow-sm"></span>
              <span className="text-base-content/70">Ruta Activa</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-success"></span>
              <span className="text-base-content/70">Bajo Riesgo</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-error"></span>
              <span className="text-base-content/70">Alto Riesgo</span>
            </span>
          </div>
        </div>

        {/* Viewport SVG */}
        <div className="w-full bg-base-200/50 rounded-xl border border-base-200 p-2 overflow-x-auto">
          <svg
            viewBox="0 0 1200 560"
            className="w-full h-auto min-h-[480px] select-none block"
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Capa de Aristas */}
            <g className="edges-layer">
              {edges.map(edge => (
                <path
                  key={edge.id}
                  d={edge.d}
                  fill="none"
                  className={`transition-all duration-300 ${
                    edge.isActive
                      ? 'stroke-primary stroke-[3.5px]'
                      : 'stroke-base-content/15 stroke-[1.5px]'
                  }`}
                />
              ))}
            </g>

            {/* Capa de Nodos */}
            <g className="nodes-layer">
              {nodes.map(node => {
                const isSelected = selectedNode?.node_id === node.node_id;
                const isHighLeaf = node.is_leaf && node.predicted_class === 1;
                const isLowLeaf = node.is_leaf && node.predicted_class === 0;

                let strokeColor = 'stroke-base-content/20';
                let strokeWidth = '1.5';
                if (node.isActive) {
                  strokeColor = isHighLeaf ? 'stroke-error' : isLowLeaf ? 'stroke-success' : 'stroke-primary';
                  strokeWidth = '2.5';
                }

                const shortFeatureLabel =
                  FEATURE_METADATA[node.feature]?.shortLabel ||
                  (node.feature_label ? node.feature_label.split(' ')[0] : node.feature);

                return (
                  <g
                    key={node.node_id}
                    transform={`translate(${node.x}, ${node.y})`}
                  >
                    <g
                      onClick={() => onSelectNode(node)}
                      className="tree-node-card cursor-pointer"
                    >
                      {/* Rectangulo del Nodo */}
                      <rect
                        x={-node.width / 2}
                        y={-node.height / 2}
                        width={node.width}
                        height={node.height}
                        rx="10"
                        ry="10"
                        className={`fill-base-100 ${strokeColor} transition-all duration-200 ${
                          node.isActive ? 'filter drop-shadow-md' : ''
                        } ${isSelected ? 'stroke-secondary stroke-[3px]' : ''}`}
                        strokeWidth={strokeWidth}
                      />

                      {/* Texto Superior: Condicion o Dictamen */}
                      <text
                        y={-6}
                        textAnchor="middle"
                        className="text-[11.5px] font-semibold fill-base-content select-none"
                      >
                        {node.is_leaf
                          ? (isHighLeaf ? 'Alto Riesgo' : 'Riesgo Bajo')
                          : `${shortFeatureLabel} <= ${node.threshold}`}
                      </text>

                      {/* Texto Inferior: Estadisticas */}
                      <text
                        y={14}
                        textAnchor="middle"
                        className="text-[10px] font-mono fill-base-content/60 select-none"
                      >
                        {node.is_leaf
                          ? `Prob: ${(node.prob_diabetic * 100).toFixed(0)}% | n=${node.n_samples}`
                          : `Gini: ${node.impurity} | n=${node.n_samples}`}
                      </text>
                    </g>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        {/* Panel de Detalle del Nodo Seleccionado */}
        <div className="bg-base-200/70 p-4 rounded-xl text-xs flex items-start gap-3">
          <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold text-base-content uppercase tracking-wider block mb-1">
              {selectedNode ? `Detalle del Nodo #${selectedNode.node_id}` : 'Inspección de Nodos'}
            </span>
            {selectedNode ? (
              <p className="text-base-content/80 leading-relaxed">
                {selectedNode.is_leaf ? (
                  <>
                    Nodo terminal de clasificación (Hoja). Dictamen: <strong>{selectedNode.predicted_label}</strong>.{' '}
                    Probabilidad estimada: <strong>{(selectedNode.prob_diabetic * 100).toFixed(1)}%</strong>.{' '}
                    Muestras de entrenamiento agrupadas: <strong>{selectedNode.n_samples}</strong>.{' '}
                    Impureza de Gini: <strong>{selectedNode.impurity}</strong>.
                  </>
                ) : (
                  <>
                    Nodo interno de bifurcación binaria. Condición evaluada:{' '}
                    <strong>{selectedNode.condition_text || `${selectedNode.feature} <= ${selectedNode.threshold}`}</strong>.{' '}
                    Muestras totales que alcanzan este nodo: <strong>{selectedNode.n_samples}</strong>.{' '}
                    Impureza de Gini previa a la partición: <strong>{selectedNode.impurity}</strong>.
                  </>
                )}
              </p>
            ) : (
              <p className="text-base-content/60">
                Haga clic sobre cualquier nodo del árbol para auditar su impureza de Gini, variable de corte y número de muestras.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
