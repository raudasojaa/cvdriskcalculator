const finriskCoefficients = {
  male: {
    coronary: {
      intercept: 11.213,
      age: 0.0802,
      smoking: 0.626,
      totalChol: 0.3293,
      systolic: 0.0166,
      hdl: 0.5893,
      diabetes: 0.7417,
      parental: 0.3138,
    },
    stroke: {
      intercept: 11.6994,
      age: 0.1153,
      smoking: 0.4881,
      systolic: 0.0149,
      hdl: 0.4406,
      diabetes: 0.879,
      parental: 0.2933,
    },
  },
  female: {
    coronary: {
      intercept: 11.839,
      age: 0.0962,
      smoking: 0.8776,
      totalChol: 0.2119,
      systolic: 0.0175,
      hdl: 1.1009,
      diabetes: 1.0303,
      parental: 0.409,
    },
    stroke: {
      intercept: 7.9766,
      age: 0.0633,
      smoking: 0.4163,
      systolic: 0.00893,
      hdl: 0.7636,
      diabetes: 1.2383,
      parental: 0.547,
    },
  },
};

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
      const sex = inputs.sex;
      const race = inputs.race || 'white';
      const smoker = inputs.smoker === 'yes' ? 1 : 0;
      const diabetes = inputs.diabetes === 'yes' ? 1 : 0;
      const bpMedicated = inputs.bpMedicated === 'yes' ? 1 : 0;
      const ckd = inputs.ckd === 'yes' ? 1 : 0;

      const age = Number(inputs.age);
      const systolic = Number(inputs.systolic);
      const totalChol = Number(inputs.totalChol);
      const hdl = Number(inputs.hdl);

      const lnAge = Math.log(age);
      const lnAgeSq = Math.pow(lnAge, 2);
      const lnTotalChol = Math.log(totalChol);
      const lnHDL = Math.log(hdl);
      const lnSBP = Math.log(systolic);

      const cohort = preventCoefficients[sex]?.[race] || preventCoefficients[sex]?.other;

      if (!cohort) {
        throw new Error('Missing PREVENT coefficient set for selected demographics.');
      }

      const linearPredictor =
        cohort.intercept +
        cohort.lnAge * lnAge +
        (cohort.lnAgeSq || 0) * lnAgeSq +
        cohort.lnTotalChol * lnTotalChol +
        (cohort.lnAge_lnTotalChol || 0) * lnAge * lnTotalChol +
        cohort.lnHDL * lnHDL +
        (cohort.lnAge_lnHDL || 0) * lnAge * lnHDL +
        (bpMedicated
          ? cohort.lnTreatedSBP * lnSBP + (cohort.lnAge_lnTreatedSBP || 0) * lnAge * lnSBP
          : cohort.lnUntreatedSBP * lnSBP + (cohort.lnAge_lnUntreatedSBP || 0) * lnAge * lnSBP) +
        cohort.smoker * smoker +
        (cohort.lnAge_smoker || 0) * lnAge * smoker +
        cohort.diabetes * diabetes +
        (cohort.ckd || 0) * ckd;

      return clampProbability(sigmoid(linearPredictor));
    },
  },
};

const preventCoefficients = {
  male: {
    white: {
      intercept: -5.55,
      lnAge: 3.08,
      lnAgeSq: -0.92,
      lnTotalChol: 1.12,
      lnAge_lnTotalChol: -0.3,
      lnHDL: -1.26,
      lnAge_lnHDL: 0.38,
      lnTreatedSBP: 1.27,
      lnAge_lnTreatedSBP: -0.35,
      lnUntreatedSBP: 1.45,
      lnAge_lnUntreatedSBP: -0.41,
      smoker: 0.76,
      lnAge_smoker: -0.21,
      diabetes: 0.64,
      ckd: 0.52,
    },
    black: {
      intercept: -5.03,
      lnAge: 2.98,
      lnAgeSq: -0.88,
      lnTotalChol: 0.94,
      lnAge_lnTotalChol: -0.24,
      lnHDL: -1.18,
      lnAge_lnHDL: 0.35,
      lnTreatedSBP: 1.35,
      lnAge_lnTreatedSBP: -0.37,
      lnUntreatedSBP: 1.51,
      lnAge_lnUntreatedSBP: -0.42,
      smoker: 0.62,
      lnAge_smoker: -0.18,
      diabetes: 0.7,
      ckd: 0.58,
    },
    other: {
      intercept: -5.45,
      lnAge: 3.01,
      lnAgeSq: -0.9,
      lnTotalChol: 1.05,
      lnAge_lnTotalChol: -0.27,
      lnHDL: -1.22,
      lnAge_lnHDL: 0.36,
      lnTreatedSBP: 1.31,
      lnAge_lnTreatedSBP: -0.36,
      lnUntreatedSBP: 1.48,
      lnAge_lnUntreatedSBP: -0.41,
      smoker: 0.7,
      lnAge_smoker: -0.2,
      diabetes: 0.66,
      ckd: 0.55,
    },
  },
  female: {
    white: {
      intercept: -6.3,
      lnAge: 2.75,
      lnAgeSq: -0.82,
      lnTotalChol: 1.18,
      lnAge_lnTotalChol: -0.32,
      lnHDL: -1.4,
      lnAge_lnHDL: 0.4,
      lnTreatedSBP: 1.21,
      lnAge_lnTreatedSBP: -0.34,
      lnUntreatedSBP: 1.33,
      lnAge_lnUntreatedSBP: -0.38,
      smoker: 0.86,
      lnAge_smoker: -0.24,
      diabetes: 0.72,
      ckd: 0.62,
    },
    black: {
      intercept: -5.92,
      lnAge: 2.68,
      lnAgeSq: -0.78,
      lnTotalChol: 1.05,
      lnAge_lnTotalChol: -0.28,
      lnHDL: -1.32,
      lnAge_lnHDL: 0.38,
      lnTreatedSBP: 1.28,
      lnAge_lnTreatedSBP: -0.36,
      lnUntreatedSBP: 1.4,
      lnAge_lnUntreatedSBP: -0.39,
      smoker: 0.74,
      lnAge_smoker: -0.22,
      diabetes: 0.78,
      ckd: 0.66,
    },
    other: {
      intercept: -6.15,
      lnAge: 2.71,
      lnAgeSq: -0.8,
      lnTotalChol: 1.12,
      lnAge_lnTotalChol: -0.3,
      lnHDL: -1.36,
      lnAge_lnHDL: 0.39,
      lnTreatedSBP: 1.25,
      lnAge_lnTreatedSBP: -0.35,
      lnUntreatedSBP: 1.37,
      lnAge_lnUntreatedSBP: -0.39,
      smoker: 0.8,
      lnAge_smoker: -0.23,
      diabetes: 0.75,
      ckd: 0.64,
    },
  },
};

const treatmentStrategies = [
  { id: 'baseline', label: 'No pharmacotherapy', multiplier: 1 },
  { id: 'bp1', label: 'One blood pressure medication', multiplier: 0.9 },
  { id: 'bp2', label: 'Two blood pressure medications', multiplier: 0.9 * 0.9 },
  { id: 'statin', label: 'Statin therapy', multiplier: 0.75 },
  {
    id: 'combo',
    label: 'Two blood pressure medications + statin',
    multiplier: 0.9 * 0.9 * 0.75,
  },
];

const chartColours = {
  background: ['#0c8fd6', '#0fa4b9', '#0bb47d', '#f3a712', '#ef476f'],
  border: ['#086394', '#0b7382', '#087955', '#c67f0d', '#c23a59'],
};

let chartInstance;

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

function calculateTreatmentRisks(baselineRisk) {
  return treatmentStrategies.map((strategy) => ({
    ...strategy,
    risk: clampProbability(baselineRisk * strategy.multiplier),
    absoluteBenefit: Math.max(0, baselineRisk - baselineRisk * strategy.multiplier),
  }));
}

function updateTreatmentList(treatments, container) {
  container.innerHTML = '';
  treatments.forEach((strategy) => {
    if (strategy.id === 'baseline') return;
    const listItem = document.createElement('li');
    listItem.innerHTML = `
      <span>${strategy.label}</span>
      <span><strong>${formatPercent(strategy.risk)}</strong> (${(strategy.absoluteBenefit * 100).toFixed(
        1,
      )}% absolute risk reduction)</span>
    `;
    container.appendChild(listItem);
  });
}

function renderChart(canvas, treatments) {
  const labels = treatments.map((t) => t.label);
  const data = treatments.map((t) => (t.risk * 100).toFixed(2));

  if (chartInstance) {
    chartInstance.data.labels = labels;
    chartInstance.data.datasets[0].data = data;
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
          backgroundColor: chartColours.background,
          borderColor: chartColours.border,
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
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
              return `${context.parsed.y.toFixed(1)}%`;
            },
          },
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

  document.getElementById('year').textContent = new Date().getFullYear();

  toggleModelFields(modelSelect.value);

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
      const baselineRisk = selectedModel.calculate(inputs);
      const formattedBaseline = formatPercent(baselineRisk);
      baselineOutput.innerHTML = `Baseline risk (${selectedModel.name}): <strong>${formattedBaseline}</strong>`;

      const treatments = calculateTreatmentRisks(baselineRisk);
      updateTreatmentList(treatments, treatmentList);
      renderChart(chartCanvas, treatments);
    } catch (error) {
      console.error(error);
      baselineOutput.innerHTML =
        '<strong>Unable to calculate risk with the current inputs. Please review the form.</strong>';
    }
  });
}

document.addEventListener('DOMContentLoaded', initializeForm);
