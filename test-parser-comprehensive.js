import { parsePrompt } from './src/utils/promptParser.js';

const testCases = [
  // Short Forms (1-20)
  {
    input: "I am a 25-year-old male and I want to lose weight.",
    expected: { age: 25, gender: 'male', goal: 'weight_loss' }
  },
  {
    input: "I am 30 years old, female, trying to gain muscle.",
    expected: { age: 30, gender: 'female', goal: 'muscle_gain' }
  },
  {
    input: "Male, 40 years, 170 cm, 70 kg, goal: fat loss.",
    expected: { age: 40, gender: 'male', height: 170, weight: 70, goal: 'weight_loss' }
  },
  {
    input: "28-year-old female, 160 cm, 55 kg, goal is to tone body.",
    expected: { age: 28, gender: 'female', height: 160, weight: 55, goal: 'toning' }
  },
  {
    input: "I am 22, male, 65 kg, 175 cm, want to bulk up.",
    expected: { age: 22, gender: 'male', height: 175, weight: 65, goal: 'muscle_gain' }
  },
  {
    input: "34-year-old woman, 68 kg, 165 cm, wants to slim down.",
    expected: { age: 34, gender: 'female', height: 165, weight: 68, goal: 'weight_loss' }
  },
  {
    input: "Male, 50 yrs, 182 cm, 80 kg, fitness goal: maintain weight.",
    expected: { age: 50, gender: 'male', height: 182, weight: 80, goal: 'maintenance' }
  },
  {
    input: "I'm a 19-year-old girl, 48 kg, 158 cm, want to gain weight.",
    expected: { age: 19, gender: 'female', height: 158, weight: 48, goal: 'muscle_gain' }
  },
  {
    input: "42, male, 90 kg, 180 cm, aim: build endurance.",
    expected: { age: 42, gender: 'male', height: 180, weight: 90, goal: 'endurance' }
  },
  {
    input: "25 y/o female, 60 kg, 162 cm, goal is fat loss.",
    expected: { age: 25, gender: 'female', height: 162, weight: 60, goal: 'weight_loss' }
  },
  
  // Mixed units (kg/lbs, cm/ft)
  {
    input: "I'm 29, male, 180 cm, 170 lbs, want to gain strength.",
    expected: { age: 29, gender: 'male', height: 180, weight: 77.1, goal: 'strength' }
  },
  {
    input: "Female, 24, 160 cm, 120 lbs, goal: fat loss.",
    expected: { age: 24, gender: 'female', height: 160, weight: 54.4, goal: 'weight_loss' }
  },
  {
    input: "Male, 42, 182 cm, 200 lbs, aim: lose belly fat.",
    expected: { age: 42, gender: 'male', height: 182, weight: 90.7, goal: 'weight_loss' }
  },
  {
    input: "31-year-old woman, 5.6 ft, 130 lbs, want to tone.",
    expected: { age: 31, gender: 'female', height: 171, weight: 59, goal: 'toning' }
  },
  {
    input: "Male, 30, 5'9\", 175 lbs, want to lose fat.",
    expected: { age: 30, gender: 'male', height: 175, weight: 79.4, goal: 'weight_loss' }
  },
  {
    input: "Female, 40, 5.4 ft, 130 lbs, goal: maintain weight.",
    expected: { age: 40, gender: 'female', height: 165, weight: 59, goal: 'maintenance' }
  },
  
  // Edge cases
  {
    input: "I'm 29M, 5.8, 160, want muscle.",
    expected: { age: 29, gender: 'male', height: 177, weight: 72.6, goal: 'muscle_gain' }
  },
  {
    input: "F30, 5.5', 125lbs, slim down.",
    expected: { age: 30, gender: 'female', height: 168, weight: 56.7, goal: 'weight_loss' }
  },
  {
    input: "Male 36, 180cm, 80, bulk.",
    expected: { age: 36, gender: 'male', height: 180, weight: 80, goal: 'muscle_gain' }
  },
  {
    input: "Woman 25, 5'4\", 55kg, tone.",
    expected: { age: 25, gender: 'female', height: 163, weight: 55, goal: 'toning' }
  },
  {
    input: "28M, 5.9ft, 165lb, strength.",
    expected: { age: 28, gender: 'male', height: 180, weight: 74.8, goal: 'strength' }
  },
  {
    input: "32F, 5.6, 130, lose fat.",
    expected: { age: 32, gender: 'female', height: 171, weight: 59, goal: 'weight_loss' }
  },
  {
    input: "M40, 6ft, 180, bulk up.",
    expected: { age: 40, gender: 'male', height: 183, weight: 81.6, goal: 'muscle_gain' }
  },
  {
    input: "F22, 5.3', 110lbs, gain weight.",
    expected: { age: 22, gender: 'female', height: 161, weight: 49.9, goal: 'muscle_gain' }
  },
  {
    input: "Male, 35, 175 cm, 77kg, muscle gain.",
    expected: { age: 35, gender: 'male', height: 175, weight: 77, goal: 'muscle_gain' }
  },
  {
    input: "Female, 28, 5'5\", 130 lb, slim waist.",
    expected: { age: 28, gender: 'female', height: 165, weight: 59, goal: 'weight_loss' }
  }
];

function compareValues(actual, expected, tolerance = 2) {
  if (typeof actual === 'number' && typeof expected === 'number') {
    return Math.abs(actual - expected) <= tolerance;
  }
  return actual === expected;
}

function runTests() {
  console.log('Running comprehensive parser tests...\n');
  let passed = 0;
  let failed = 0;
  const failures = [];

  testCases.forEach((testCase, index) => {
    const result = parsePrompt(testCase.input);
    const testNum = index + 1;
    let testPassed = true;
    const issues = [];

    // Check each expected field
    for (const [key, expectedValue] of Object.entries(testCase.expected)) {
      const actualValue = result[key];
      
      if (!compareValues(actualValue, expectedValue)) {
        testPassed = false;
        issues.push(`  ${key}: expected ${expectedValue}, got ${actualValue}`);
      }
    }

    if (testPassed) {
      console.log(`✓ Test ${testNum}: PASSED`);
      console.log(`  Input: "${testCase.input}"`);
      console.log(`  Extracted: age=${result.age}, gender=${result.gender}, height=${result.height}, weight=${result.weight}, goal=${result.goal}\n`);
      passed++;
    } else {
      console.log(`✗ Test ${testNum}: FAILED`);
      console.log(`  Input: "${testCase.input}"`);
      console.log(`  Issues:`);
      issues.forEach(issue => console.log(issue));
      console.log(`  Full result:`, result, '\n');
      failed++;
      failures.push({ testNum, input: testCase.input, issues });
    }
  });

  console.log('\n' + '='.repeat(50));
  console.log(`Test Results: ${passed} passed, ${failed} failed out of ${testCases.length} total`);
  console.log(`Success rate: ${((passed / testCases.length) * 100).toFixed(1)}%`);
  
  if (failures.length > 0) {
    console.log('\nFailed tests summary:');
    failures.forEach(f => {
      console.log(`- Test ${f.testNum}: "${f.input}"`);
      f.issues.forEach(issue => console.log(issue));
    });
  }
}

// Run the tests
runTests();
