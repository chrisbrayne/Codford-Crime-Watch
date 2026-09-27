import { CrimeSummary } from '../types';

export interface ParishRiskMetrics {
  durationMonths: number;
  totalCrimes: number;
  monthlyAverage: number;
  annualizedTotal: number;
  codfordRatePerThousand: number;
  codfordMonthlyPerThousand: number;
  wiltshireAnnualRate: number; // 56.2
  wiltshireMonthlyRate: number; // 4.7
  nationalAnnualRate: number; // 89.3
  nationalMonthlyRate: number; // 7.4
  percentLowerThanWiltshire: number;
  percentLowerThanNational: number;
  violentCount: number;
  propertyCount: number;
  asbCount: number;
  otherCount: number;
  riskRating: 'Exceptionally Low' | 'Very Low' | 'Low' | 'Moderate';
}

export const parseDurationMonths = (dateStr: string): number => {
  if (!dateStr) return 1;
  if (dateStr.includes(' to ')) {
    const [start, end] = dateStr.split(' to ');
    const [sY, sM] = start.split('-').map(Number);
    const [eY, eM] = end.split('-').map(Number);
    if (!isNaN(sY) && !isNaN(sM) && !isNaN(eY) && !isNaN(eM)) {
      return Math.max(1, (eY - sY) * 12 + (eM - sM) + 1);
    }
  }
  return 1;
};

export const calculateParishRiskMetrics = (
  dateStr: string,
  summary: CrimeSummary,
  population = 700
): ParishRiskMetrics => {
  const durationMonths = parseDurationMonths(dateStr);
  const total = summary?.total || 0;
  const monthlyAverage = Number((total / durationMonths).toFixed(2));
  const annualizedTotal = Number(((total / durationMonths) * 12).toFixed(1));
  
  // Rate per 1,000 residents
  const codfordRatePerThousand = Number(((annualizedTotal / population) * 1000).toFixed(1));
  const codfordMonthlyPerThousand = Number(((monthlyAverage / population) * 1000).toFixed(2));

  const wiltshireAnnualRate = 56.2;
  const wiltshireMonthlyRate = 4.7;
  const nationalAnnualRate = 89.3;
  const nationalMonthlyRate = 7.4;

  const diffWiltshire = ((wiltshireAnnualRate - codfordRatePerThousand) / wiltshireAnnualRate) * 100;
  const percentLowerThanWiltshire = Math.round(Math.max(-200, Math.min(100, diffWiltshire)));

  const diffNational = ((nationalAnnualRate - codfordRatePerThousand) / nationalAnnualRate) * 100;
  const percentLowerThanNational = Math.round(Math.max(-200, Math.min(100, diffNational)));

  // Categorize incidents
  let violentCount = 0;
  let propertyCount = 0;
  let asbCount = 0;
  let otherCount = 0;

  (summary?.byCategory || []).forEach((item) => {
    const name = item.name.toLowerCase();
    if (
      name.includes('violence') ||
      name.includes('weapon') ||
      name.includes('robbery') ||
      name.includes('public order')
    ) {
      violentCount += item.value;
    } else if (
      name.includes('burglary') ||
      name.includes('vehicle') ||
      name.includes('theft') ||
      name.includes('damage') ||
      name.includes('shoplifting')
    ) {
      propertyCount += item.value;
    } else if (name.includes('anti-social') || name.includes('antisocial')) {
      asbCount += item.value;
    } else {
      otherCount += item.value;
    }
  });

  let riskRating: 'Exceptionally Low' | 'Very Low' | 'Low' | 'Moderate' = 'Exceptionally Low';
  if (codfordRatePerThousand > 40) {
    riskRating = 'Moderate';
  } else if (codfordRatePerThousand > 25) {
    riskRating = 'Low';
  } else if (codfordRatePerThousand > 10) {
    riskRating = 'Very Low';
  }

  return {
    durationMonths,
    totalCrimes: total,
    monthlyAverage,
    annualizedTotal,
    codfordRatePerThousand,
    codfordMonthlyPerThousand,
    wiltshireAnnualRate,
    wiltshireMonthlyRate,
    nationalAnnualRate,
    nationalMonthlyRate,
    percentLowerThanWiltshire,
    percentLowerThanNational,
    violentCount,
    propertyCount,
    asbCount,
    otherCount,
    riskRating,
  };
};

export const formatPeriodDisplay = (dateStr: string): string => {
  if (!dateStr) return '-';
  if (dateStr.includes(' to ')) {
    const [start, end] = dateStr.split(' to ');
    const fmt = (s: string) => {
      const [year, month] = s.split('-').map(Number);
      return new Date(year, month - 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    };
    return `${fmt(start)} to ${fmt(end)}`;
  }
  const [year, month] = dateStr.split('-').map(Number);
  return new Date(year, month - 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
};

export const generateDynamicRiskAssessment = (
  dateStr: string,
  summary: CrimeSummary,
  seed = 0
): string => {
  const metrics = calculateParishRiskMetrics(dateStr, summary);
  const formattedPeriod = formatPeriodDisplay(dateStr);
  const {
    durationMonths,
    totalCrimes,
    monthlyAverage,
    codfordRatePerThousand,
    percentLowerThanWiltshire,
    percentLowerThanNational,
    violentCount,
    propertyCount,
    asbCount,
    riskRating,
  } = metrics;

  const topCategory = summary?.mostFrequentCategory || 'None recorded';

  // Variation phrasing based on seed/refresh
  const greetings = [
    'Evening All.',
    'Evening All,',
    'Evening All.',
  ];
  const greeting = greetings[seed % greetings.length];

  // Duration phrasing
  const periodText = durationMonths === 1
    ? `the month of ${formattedPeriod}`
    : `the ${durationMonths}-month span of ${formattedPeriod}`;

  // Comparative statement
  let compStatement = '';
  if (percentLowerThanWiltshire > 0) {
    compStatement = `At **${codfordRatePerThousand} crimes per 1,000 residents annually**, Codford sits **${percentLowerThanWiltshire}% lower than the Wiltshire county average** (~56/1,000) and **${percentLowerThanNational}% below the national England & Wales baseline** (~89/1,000).`;
  } else {
    compStatement = `Codford logged an annualized rate of ${codfordRatePerThousand} per 1,000 residents, remaining in line with rural benchmarks across the South West.`;
  }

  // Personal safety synthesis
  let personalSafetyText = '';
  if (violentCount === 0) {
    personalSafetyText = `Personal safety in the parish remains exceptionally secure: official records show **zero recorded incidents of robbery, knife crime, or serious violence** throughout ${periodText}.`;
  } else {
    personalSafetyText = `In terms of personal safety, ${violentCount} incident${violentCount === 1 ? '' : 's'} fell under violence or public order categories. In a quiet parish like Codford, these are almost universally localized or isolated interpersonal disputes rather than predatory street crime, meaning day-to-day risk to residents and walkers remains minimal.`;
  }

  // Property & ASB synthesis
  let propertyText = '';
  if (propertyCount === 0 && asbCount === 0) {
    propertyText = `No burglaries, vehicle crimes, or anti-social behaviour incidents were recorded during this timeframe.`;
  } else {
    const details: string[] = [];
    if (propertyCount > 0) {
      details.push(`${propertyCount} acquisitive or property-related incident${propertyCount === 1 ? '' : 's'} (including ${topCategory.toLowerCase()})`);
    }
    if (asbCount > 0) {
      details.push(`${asbCount} report${asbCount === 1 ? '' : 's'} of anti-social behaviour`);
    }
    propertyText = `Regarding property and village amenities, Wiltshire Police logged ${details.join(' alongside ')}. In a rural valley setting, secure lock-ups for sheds, outbuildings, and vehicles remain the primary sensible precaution.`;
  }

  // Small numbers perspective
  let smallNumbersContext = '';
  if (durationMonths > 1) {
    smallNumbersContext = `Averaging **${monthlyAverage} incident${monthlyAverage === 1 ? '' : 's'} per month** across a parish population of approximately 700 residents reaffirms an overall risk tier of **${riskRating}**. Over an extended period, the numbers show consistent rural stability rather than any emerging crime pattern.`;
  } else {
    smallNumbersContext = `With a close-knit population of approximately 700 residents, even a single isolated event creates an artificial percentage swing on paper, but the physical reality on our village lanes is an overall community risk tier of **${riskRating}**.`;
  }

  return `${greeting}

Taking an objective, evidence-based look at Wiltshire Police figures for ${periodText}, Codford recorded **${totalCrimes} official incident${totalCrimes === 1 ? '' : 's'}**. ${compStatement}

${personalSafetyText} ${propertyText}

${smallNumbersContext} Staying watchful, keeping outbuildings fastened, and looking out for elderly neighbours ensures our parish continues to be the peaceful Wylye Valley haven we all value.

Don't have nightmares!`;
};
