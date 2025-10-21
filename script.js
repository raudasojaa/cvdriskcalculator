const finriskCoefficients = {
  male: {
    coronary: {
      intercept: 9.081,
      age: 0.075,
      smoking: 0.579,
      totalChol: 0.320,
      systolic: 0.011,
      hdl: 1.082,
      diabetes: 0.729,
      parental: 0.338,
    },
    stroke: {
      intercept: 9.928,
      age: 0.083,
      smoking: 0.369,
      systolic: 0.014,
      hdl: 0.329,
      diabetes: 0.705,
      parental: 0.249,
    },
  },
  female: {
    coronary: {
      intercept: 11.25,
      age: 0.095,
      smoking: 0.639,
      totalChol: 0.244,
      systolic: 0.013,
      hdl: 0.845,
      diabetes: 1.315,
      parental: 0.421,
    },
    stroke: {
      intercept: 9.553,
      age: 0.085,
      smoking: 0.613,
      systolic: 0.012,
      hdl: 0.623,
      diabetes: 0.914,
      parental: 0.023,
    },
  },
};

const MG_DL_TO_MMOL_CHOLESTEROL = 38.67;

const riskModels = {
  finrisk: {
    id: 'finrisk',
    name: 'FINRISK',
    description:
      'FINRISK estimates 10-year risk of major coronary events and stroke using Finnish cohort data.',
    calculate(inputs) {
      const sex = inputs.sex === 'female' ? 'female' : 'male';
      const smoker = inputs.smoker === 'yes' ? 1 : 0;
      const diabetes = inputs.diabetes === 'yes' ? 1 : 0;
      const parentInfarction = inputs.parentInfarction === 'yes' ? 1 : 0;
      const parentStroke = inputs.parentStroke === 'yes' ? 1 : 0;

      const age = Number(inputs.age);
      const systolic = Number(inputs.systolic);
      const totalChol = Number(inputs.totalChol);
      const hdl = Number(inputs.hdl);

      const coefficients = finriskCoefficients[sex];

      if (!coefficients) {
        throw new Error('Missing FINRISK coefficients for selected sex.');
      }

      const coronary = coefficients.coronary;
      const stroke = coefficients.stroke;

      const coronaryExponent =
        coronary.intercept -
        coronary.age * age -
        coronary.smoking * smoker -
        (coronary.totalChol || 0) * totalChol -
        coronary.systolic * systolic +
        coronary.hdl * hdl -
        coronary.diabetes * diabetes -
        coronary.parental * parentInfarction;

      const strokeExponent =
        stroke.intercept -
        stroke.age * age -
        stroke.smoking * smoker -
        stroke.systolic * systolic +
        stroke.hdl * hdl -
        stroke.diabetes * diabetes -
        stroke.parental * parentStroke;

      const coronaryRisk = 1 / (1 + Math.exp(coronaryExponent));
      const strokeRisk = 1 / (1 + Math.exp(strokeExponent));

      const combinedRisk = 1 - (1 - coronaryRisk) * (1 - strokeRisk);

      return clampProbability(combinedRisk);
    },
  },
  prevent: {
    id: 'prevent',
    name: 'PREVENT',
    description:
      'PREVENT relies on U.S. cohort data and expands on the pooled cohort equations to estimate 10-year cardiovascular risk.',
    calculate(inputs) {
      const sex = inputs.sex === 'female' ? 'female' : 'male';
      const race = typeof inputs.race === 'string' ? inputs.race : 'white';
      const smoker = inputs.smoker === 'yes' ? 1 : 0;
      const diabetes = inputs.diabetes === 'yes' ? 1 : 0;
      const bpMedicated = inputs.bpMedicated === 'yes' ? 1 : 0;
      const statin = inputs.statin === 'yes' ? 1 : 0;

      const age = Number(inputs.age);
      const systolic = Number(inputs.systolic);
      const totalChol = Number(inputs.totalChol);
      const hdl = Number(inputs.hdl);
      const egfr = Number(inputs.egfr);
      const bmi = Number(inputs.bmi);

      if ([age, systolic, totalChol, hdl, egfr, bmi].some((value) => !Number.isFinite(value))) {
        throw new Error('Missing or invalid numeric inputs for PREVENT calculation.');
      }

      const coefficients = preventEquationCoefficients[sex];

      if (!coefficients) {
        throw new Error('Missing PREVENT coefficients for selected sex.');
      }

      const ageTerm = (age - 55) / 10;
      const nonHdlTerm = totalChol - hdl - 3.5;
      const hdlTerm = (hdl - 1.3) / 0.3;
      const sbpBelowTerm = (Math.min(systolic, 110) - 110) / 20;
      const sbpAboveTerm = (Math.max(systolic, 110) - 130) / 20;
      const egfrBelowTerm = (Math.min(egfr, 60) - 60) / -15;
      const egfrAboveTerm = (Math.max(egfr, 60) - 90) / -15;
      const bmiTerm = (bmi - 27) / 5;

      const raceAdjustments = coefficients.race || {};
      const raceOffset = raceAdjustments[race] ?? 0;

      const logOdds =
        coefficients.intercept +
        raceOffset +
        coefficients.age * ageTerm +
        coefficients.nonHdl * nonHdlTerm +
        coefficients.hdl * hdlTerm +
        coefficients.sbpBelow * sbpBelowTerm +
        coefficients.sbpAbove * sbpAboveTerm +
        coefficients.diabetes * diabetes +
        coefficients.smoker * smoker +
        coefficients.egfrBelow * egfrBelowTerm +
        coefficients.egfrAbove * egfrAboveTerm +
        coefficients.antiHypertensive * bpMedicated +
        coefficients.statin * statin +
        coefficients.antiHypertensive_sbpAbove * bpMedicated * sbpAboveTerm +
        coefficients.statin_nonHdl * statin * nonHdlTerm +
        coefficients.age_nonHdl * ageTerm * nonHdlTerm +
        coefficients.age_hdl * ageTerm * hdlTerm +
        coefficients.age_sbpAbove * ageTerm * sbpAboveTerm +
        coefficients.age_diabetes * ageTerm * diabetes +
        coefficients.age_smoker * ageTerm * smoker +
        coefficients.age_egfrBelow * ageTerm * egfrBelowTerm +
        (coefficients.bmi || 0) * bmiTerm +
        (coefficients.age_bmi || 0) * ageTerm * bmiTerm;

      return clampProbability(sigmoid(logOdds));
    },
  },
};

const preventEquationCoefficients = {
  female: {
    intercept: -3.312541,
    age: 0.7939329,
    nonHdl: 0.0305239,
    hdl: -0.1606857,
    sbpBelow: -0.2394003,
    sbpAbove: 0.360078,
    diabetes: 0.8667604,
    smoker: 0.5360739,
    egfrBelow: 0.6045917,
    egfrAbove: 0.0433769,
    antiHypertensive: 0.3151672,
    statin: -0.1477655,
    antiHypertensive_sbpAbove: -0.0663612,
    statin_nonHdl: 0.1197879,
    age_nonHdl: -0.0819715,
    age_hdl: 0.0306769,
    age_sbpAbove: -0.0946348,
    age_diabetes: -0.27057,
    age_smoker: -0.078715,
    age_egfrBelow: -0.1637806,
    bmi: 0.035,
    age_bmi: 0.02,
    race: {
      white: 0,
      black: 0.38,
      other: 0.15,
    },
  },
  male: {
    intercept: -3.035981,
    age: 0.7688528,
    nonHdl: 0.0736174,
    hdl: -0.0954431,
    sbpBelow: -0.4347345,
    sbpAbove: 0.3362658,
    diabetes: 0.7692857,
    smoker: 0.4386871,
    egfrBelow: 0.5378979,
    egfrAbove: 0.0164827,
    antiHypertensive: 0.288879,
    statin: -0.1337349,
    antiHypertensive_sbpAbove: -0.0475924,
    statin_nonHdl: 0.150273,
    age_nonHdl: -0.0517874,
    age_hdl: 0.0191169,
    age_sbpAbove: -0.1049477,
    age_diabetes: -0.2251948,
    age_smoker: -0.0895067,
    age_egfrBelow: -0.1543702,
    bmi: 0.03,
    age_bmi: 0.02,
    race: {
      white: 0,
      black: 0.52,
      other: 0.1,
    },
  },
};

const treatmentStrategies = [
  { id: 'baseline', label: 'No pharmacotherapy', multiplier: 1 },
  { id: 'bp1', label: 'One blood pressure medication', multiplier: 0.9 },
  { id: 'bp2', label: 'Two blood pressure medications', multiplier: 0.9 * 0.9 },
  { id: 'statin', label: 'Statin therapy', multiplier: 0.75 },
  {
    id: 'bp1Statin',
    label: 'One blood pressure medication + statin',
    multiplier: 0.9 * 0.75,
  },
  {
    id: 'combo',
    label: 'Two blood pressure medications + statin',
    multiplier: 0.9 * 0.9 * 0.75,
  },
];

const chartColours = {
  background: ['#0c8fd6', '#0fa4b9', '#0bb47d', '#f3a712', '#ef476f', '#7353ba'],
  border: ['#086394', '#0b7382', '#087955', '#c67f0d', '#c23a59', '#54348d'],
};

let chartInstance;
let latestTreatmentResults = [];
let treatmentCheckboxContainer;
let treatmentSummaryNote;
let treatmentSummaryBaseline;

function sigmoid(value) {
  return 1 / (1 + Math.exp(-value));
}

function clampProbability(value) {
  if (Number.isNaN(value)) return 0;
  return Math.min(Math.max(value, 0), 0.95);
}

function formatPercent(probability) {
  return `${(probability * 100).toFixed(1)}%`;
}

function collectFormData(form) {
  const formData = new FormData(form);
  return Object.fromEntries(formData.entries());
}

function normalizeInputs(inputs, modelKey) {
  const normalized = { ...inputs };

  const numericFields = ['age', 'systolic', 'totalChol', 'hdl', 'egfr', 'bmi'];
  numericFields.forEach((field) => {
    if (field in normalized) {
      const rawValue = normalized[field];
      if (rawValue !== '' && rawValue !== null && rawValue !== undefined) {
        const parsed = Number(rawValue);
        if (Number.isFinite(parsed)) {
          normalized[field] = parsed;
        }
      }
    }
  });

  if (modelKey === 'finrisk' || modelKey === 'prevent') {
    if (Number.isFinite(normalized.totalChol)) {
      normalized.totalChol = normalized.totalChol / MG_DL_TO_MMOL_CHOLESTEROL;
    }
    if (Number.isFinite(normalized.hdl)) {
      normalized.hdl = normalized.hdl / MG_DL_TO_MMOL_CHOLESTEROL;
    }
  }

  return normalized;
}

function calculateTreatmentRisks(baselineRisk) {
  return treatmentStrategies.map((strategy) => ({
    ...strategy,
    risk: clampProbability(baselineRisk * strategy.multiplier),
    absoluteBenefit: Math.max(0, baselineRisk - baselineRisk * strategy.multiplier),
  }));
}

function getSelectedTreatmentIds(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll("input[type='checkbox']:checked")).map(
    (input) => input.value,
  );
}

function buildTreatmentCheckboxes(container, onChange) {
  if (!container) return;
  container.innerHTML = '';

  treatmentStrategies.forEach((strategy) => {
    const option = document.createElement('div');
    option.className = 'checkbox-option';

    const checkboxId = `treatment-${strategy.id}`;
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = checkboxId;
    checkbox.value = strategy.id;
    checkbox.checked = true;
    checkbox.addEventListener('change', onChange);

    const label = document.createElement('label');
    label.setAttribute('for', checkboxId);
    label.textContent = strategy.label;

    option.appendChild(checkbox);
    option.appendChild(label);
    container.appendChild(option);
  });
}

function updateTreatmentSummaryBaseline(baselineRisk) {
  if (!treatmentSummaryBaseline) return;
  if (Number.isFinite(baselineRisk)) {
    treatmentSummaryBaseline.textContent = `(baseline ${formatPercent(baselineRisk)})`;
  } else {
    treatmentSummaryBaseline.textContent = '';
  }
}

function updateTreatmentList(treatments, container, noteElement) {
  if (!container) return;

  container.innerHTML = '';

  const applicableTreatments = Array.isArray(treatments)
    ? treatments.filter((strategy) => strategy.id !== 'baseline')
    : [];

  if (!applicableTreatments.length) {
    if (noteElement) {
      noteElement.textContent = 'Calculate risk to view estimated benefits for each treatment strategy.';
    }

    const emptyState = document.createElement('li');
    emptyState.className = 'empty-state';
    emptyState.textContent = 'No treatment comparisons available yet.';
    container.appendChild(emptyState);
    return;
  }

  if (noteElement) {
    noteElement.textContent =
      'Estimated 10-year risk and absolute risk reduction compared with no pharmacotherapy.';
  }

  applicableTreatments.forEach((strategy) => {
    const listItem = document.createElement('li');

    const label = document.createElement('span');
    label.textContent = strategy.label;

    const value = document.createElement('span');
    const absoluteReduction = (strategy.absoluteBenefit * 100).toFixed(1);
    value.innerHTML = `<strong>${formatPercent(strategy.risk)}</strong> (${absoluteReduction}% absolute risk reduction)`;

    listItem.appendChild(label);
    listItem.appendChild(value);
    container.appendChild(listItem);
  });
}

const barValueLabelPlugin = {
  id: 'barValueLabel',
  afterDatasetsDraw(chart, args, pluginOptions) {
    const { ctx, data } = chart;
    const dataset = data.datasets?.[0];
    if (!dataset) return;

    const meta = chart.getDatasetMeta(0);
    if (!meta || !meta.data) return;

    const rootStyles = window.getComputedStyle(document.documentElement);
    const fallbackColour = pluginOptions?.color?.trim() || rootStyles.getPropertyValue('--text').trim() || '#1c2833';
    const fontOptions = pluginOptions?.font || {};
    const fontSize = fontOptions.size || 12;
    const fontFamily = fontOptions.family || "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif";
    const fontWeight = fontOptions.weight || '600';
    const yOffset = pluginOptions?.offset ?? 6;

    ctx.save();
    ctx.fillStyle = fallbackColour;
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    meta.data.forEach((element, index) => {
      const rawValue = dataset.data?.[index];
      if (!Number.isFinite(rawValue)) return;

      const position = element.tooltipPosition();
      ctx.fillText(`${Number(rawValue).toFixed(1)}%`, position.x, position.y - yOffset);
    });

    ctx.restore();
  },
};

function renderChart(canvas, treatments) {
  const labels = treatments.map((t) => t.label);
  const data = treatments.map((t) => Number((t.risk * 100).toFixed(2)));
  const backgrounds = treatments.map(
    (_, index) => chartColours.background[index % chartColours.background.length],
  );
  const borders = treatments.map(
    (_, index) => chartColours.border[index % chartColours.border.length],
  );

  if (chartInstance) {
    chartInstance.data.labels = labels;
    chartInstance.data.datasets[0].data = data;
    chartInstance.data.datasets[0].backgroundColor = backgrounds;
    chartInstance.data.datasets[0].borderColor = borders;
    chartInstance.update();
    return;
  }

  chartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Estimated risk',
          data,
          backgroundColor: backgrounds,
          borderColor: borders,
          borderWidth: 1,
        },
      ],
    },
    plugins: [barValueLabelPlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          max: 50,
          ticks: {
            callback: (value) => `${value}%`,
          },
          title: {
            display: true,
            text: '10-year risk (%)',
          },
        },
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label(context) {
              const value = context.parsed.y;
              if (Number.isFinite(value)) {
                return `${value.toFixed(1)}%`;
              }
              return '0.0%';
            },
          },
        },
        barValueLabel: {
          offset: 10,
        },
      },
      animation: {
        duration: 400,
        easing: 'easeOutQuart',
      },
    },
  });
}

function toggleModelFields(selectedModel) {
  const preventFields = document.querySelectorAll('.prevent-only');
  const finriskFields = document.querySelectorAll('.finrisk-only');

  preventFields.forEach((field) => {
    if (selectedModel === 'prevent') {
      field.removeAttribute('hidden');
    } else {
      field.setAttribute('hidden', 'hidden');
    }
  });

  finriskFields.forEach((field) => {
    if (selectedModel === 'finrisk') {
      field.removeAttribute('hidden');
    } else {
      field.setAttribute('hidden', 'hidden');
    }
  });
}

function initializeForm() {
  const form = document.getElementById('risk-form');
  const modelSelect = document.getElementById('model');
  const baselineOutput = document.getElementById('baseline-risk');
  const treatmentList = document.getElementById('treatment-list');
  const chartCanvas = document.getElementById('risk-chart');
  treatmentCheckboxContainer = document.getElementById('treatment-checkboxes');
  treatmentSummaryNote = document.getElementById('treatment-summary-note');
  treatmentSummaryBaseline = document.getElementById('treatment-summary-baseline');

  document.getElementById('year').textContent = new Date().getFullYear();

  toggleModelFields(modelSelect.value);

  const applySelectedTreatmentsToChart = () => {
    if (!chartCanvas) return;
    const selectedIds = new Set(getSelectedTreatmentIds(treatmentCheckboxContainer));
    const filteredTreatments = latestTreatmentResults.filter((strategy) =>
      selectedIds.has(strategy.id),
    );
    renderChart(chartCanvas, filteredTreatments);
  };

  buildTreatmentCheckboxes(treatmentCheckboxContainer, applySelectedTreatmentsToChart);
  renderChart(chartCanvas, []);
  updateTreatmentSummaryBaseline();
  updateTreatmentList([], treatmentList, treatmentSummaryNote);

  modelSelect.addEventListener('change', (event) => {
    toggleModelFields(event.target.value);
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const inputs = collectFormData(form);
    const modelKey = inputs.model;
    const selectedModel = riskModels[modelKey];

    if (!selectedModel) {
      baselineOutput.innerHTML = '<strong>Unable to locate selected model.</strong>';
      return;
    }

    try {
      const normalizedInputs = normalizeInputs(inputs, modelKey);
      const baselineRisk = selectedModel.calculate(normalizedInputs);
      const formattedBaseline = formatPercent(baselineRisk);
      baselineOutput.innerHTML = `Baseline risk (${selectedModel.name}): <strong>${formattedBaseline}</strong>`;

      const treatments = calculateTreatmentRisks(baselineRisk);
      latestTreatmentResults = treatments;
      updateTreatmentSummaryBaseline(baselineRisk);
      updateTreatmentList(treatments, treatmentList, treatmentSummaryNote);
      applySelectedTreatmentsToChart();
    } catch (error) {
      console.error(error);
      baselineOutput.innerHTML =
        '<strong>Unable to calculate risk with the current inputs. Please review the form.</strong>';
      updateTreatmentSummaryBaseline();
      updateTreatmentList([], treatmentList, treatmentSummaryNote);
    }
  });
}

document.addEventListener('DOMContentLoaded', initializeForm);
