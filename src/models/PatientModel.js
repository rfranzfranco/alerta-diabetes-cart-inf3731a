/**
 * MODEL: PatientModel.js
 * Metadatos clinicos, medianas de imputacion, guias de pedigree y casos de prueba.
 * INF-3731A - Inteligencia Artificial.
 */

export const FEATURE_METADATA = {
  Glucose: {
    key: 'Glucose',
    label: 'Glucosa plasmática a 2h',
    shortLabel: 'Glucosa',
    unit: 'mg/dL',
    min: 44,
    max: 200,
    step: 1,
    default: 115,
    trainMedian: 117.0,
    canBeUnmeasured: true,
    isUsedInTree: true,
    treeImportancePct: 58.64,
    refNormal: 'OGTT 2h normal: < 140 mg/dL',
    refTree: 'Cortes CART: 132.5 y 154.5 mg/dL',
    category: 'metabolism'
  },
  Insulin: {
    key: 'Insulin',
    label: 'Insulina sérica a 2h',
    shortLabel: 'Insulina',
    unit: 'µU/mL',
    min: 14,
    max: 846,
    step: 1,
    default: 85,
    trainMedian: 125.0,
    canBeUnmeasured: true,
    isUsedInTree: true,
    treeImportancePct: 2.24,
    refNormal: 'Basal normal: 15–100 µU/mL',
    refTree: 'Corte CART: > 80.0 µU/mL',
    category: 'metabolism'
  },
  SkinThickness: {
    key: 'SkinThickness',
    label: 'Pliegue cutáneo del tríceps',
    shortLabel: 'Pliegue tricipital',
    unit: 'mm',
    min: 7,
    max: 99,
    step: 1,
    default: 25,
    trainMedian: 29.0,
    canBeUnmeasured: true,
    isUsedInTree: false,
    treeImportancePct: 0.0,
    refNormal: 'Percentil 50: 20–25 mm',
    refTree: 'No participa en max_depth=3',
    category: 'metabolism'
  },
  BMI: {
    key: 'BMI',
    label: 'Índice de Masa Corporal (IMC)',
    shortLabel: 'IMC',
    unit: 'kg/m²',
    min: 15.0,
    max: 67.0,
    step: 0.1,
    default: 28.5,
    trainMedian: 32.4,
    canBeUnmeasured: true,
    isUsedInTree: true,
    treeImportancePct: 23.27,
    refNormal: 'Normopeso: 18.5–24.9 kg/m²',
    refTree: 'Cortes CART: 26.9, 29.95 y 45.4',
    category: 'biometry'
  },
  Age: {
    key: 'Age',
    label: 'Edad cronológica',
    shortLabel: 'Edad',
    unit: 'años',
    min: 21,
    max: 85,
    step: 1,
    default: 35,
    trainMedian: 30.0,
    canBeUnmeasured: false,
    isUsedInTree: true,
    treeImportancePct: 15.84,
    refNormal: 'Cohorte Pima: 21–81 años',
    refTree: 'Corte CART: > 30.5 años',
    category: 'biometry'
  },
  BloodPressure: {
    key: 'BloodPressure',
    label: 'Presión arterial diastólica',
    shortLabel: 'Presión diastólica',
    unit: 'mm Hg',
    min: 40,
    max: 130,
    step: 1,
    default: 72,
    trainMedian: 72.0,
    canBeUnmeasured: true,
    isUsedInTree: false,
    treeImportancePct: 0.0,
    refNormal: 'Óptima: < 80 mm Hg',
    refTree: 'No participa en max_depth=3',
    category: 'biometry'
  },
  Pregnancies: {
    key: 'Pregnancies',
    label: 'Número de embarazos',
    shortLabel: 'Embarazos',
    unit: 'gestas',
    min: 0,
    max: 17,
    step: 1,
    default: 2,
    trainMedian: 3.0,
    canBeUnmeasured: false,
    isUsedInTree: false,
    treeImportancePct: 0.0,
    refNormal: 'Rango habitual: 0–6',
    refTree: 'No participa en max_depth=3',
    category: 'biometry'
  },
  DiabetesPedigreeFunction: {
    key: 'DiabetesPedigreeFunction',
    label: 'Pedigree genético familiar (DPF)',
    shortLabel: 'Pedigree DPF',
    unit: 'índice',
    min: 0.05,
    max: 2.50,
    step: 0.01,
    default: 0.45,
    trainMedian: 0.38,
    canBeUnmeasured: false,
    isUsedInTree: false,
    treeImportancePct: 0.0,
    refNormal: 'Sin carga alta: < 0.45',
    refTree: 'No participa en max_depth=3',
    category: 'biometry'
  }
};

export const PEDIGREE_PRESETS = [
  { id: 'none', label: 'Sin antecedentes', hint: 'Ningún familiar conocido', value: 0.20 },
  { id: 'second_degree', label: '2.º grado (abuelos/tíos)', hint: 'Carga hereditaria moderada', value: 0.45 },
  { id: 'first_degree', label: 'Padre / madre / hermano', hint: '1 familiar directo con DM2', value: 0.75 },
  { id: 'multiple', label: 'Múltiples directos', hint: '2+ familiares directos', value: 1.15 }
];

export const CLINICAL_PRESETS = [
  {
    id: 'asymptomatic',
    label: '1. Asintomática Joven (R1)',
    description: 'Bajo riesgo: glucosa 85 mg/dL, edad 23 años, IMC normal',
    badgeClass: 'badge-success',
    data: {
      Pregnancies: 1,
      Glucose: 85,
      BloodPressure: 66,
      SkinThickness: 23,
      Insulin: 70,
      BMI: 22.5,
      DiabetesPedigreeFunction: 0.25,
      Age: 23
    }
  },
  {
    id: 'undiagnosed_r4',
    label: '2. Sin Diagnóstico / Frontera (R4)',
    description: 'Tamizaje sin insulina ni pliegue medidos; >30 años y sobrepeso',
    badgeClass: 'badge-warning',
    data: {
      Pregnancies: 2,
      Glucose: 124,
      BloodPressure: 76,
      SkinThickness: 0,
      Insulin: 0,
      BMI: 29.8,
      DiabetesPedigreeFunction: 0.48,
      Age: 36
    }
  },
  {
    id: 'borderline_r6',
    label: '3. Intolerancia + Obesidad (R6)',
    description: 'Alto riesgo: glucosa 142 mg/dL e IMC 31.5 kg/m²',
    badgeClass: 'badge-warning',
    data: {
      Pregnancies: 3,
      Glucose: 142,
      BloodPressure: 82,
      SkinThickness: 30,
      Insulin: 110,
      BMI: 31.5,
      DiabetesPedigreeFunction: 0.62,
      Age: 41
    }
  },
  {
    id: 'hyperglycemia',
    label: '4. Diabetes / Hiperglucemia (R8)',
    description: 'Alto riesgo metabólico: glucosa 168 mg/dL e insulina 175 µU/mL',
    badgeClass: 'badge-error',
    data: {
      Pregnancies: 5,
      Glucose: 168,
      BloodPressure: 88,
      SkinThickness: 36,
      Insulin: 175,
      BMI: 35.4,
      DiabetesPedigreeFunction: 0.85,
      Age: 52
    }
  }
];

export const getDefaultPatientValues = () => {
  const defaults = {};
  Object.values(FEATURE_METADATA).forEach(feat => {
    defaults[feat.key] = feat.default;
  });
  return defaults;
};
