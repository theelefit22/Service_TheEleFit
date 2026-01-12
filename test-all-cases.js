const { PromptParser } = require('./src/utils/promptParser.js');

const parser = new PromptParser();

// Test cases from the user's message
const testCases = [
  { input: "I am a 25-year-old male and I want to lose weight.", expected: {age:25,gender:"male",goal:"weight_loss"} },
  { input: "Male, 50 yrs, 182 cm, 80 kg, fitness goal: maintain weight.", expected: {age:50,gender:"male",height:182,weight:80,goal:"weight_maintenance"} },
  { input: "I'm a 19-year-old girl, 48 kg, 158 cm, want to gain weight.", expected: {age:19,gender:"female",height:158,weight:48,goal:"weight_gain"} },
  { input: "33-year-old male, 185 cm, 90 kg, goal: body recomposition.", expected: {age:33,gender:"male",height:185,weight:90,goal:"body_recomposition"} },
  { input: "Woman, 29, 55 kg, 162 cm, goal is weight gain.", expected: {age:29,gender:"female",height:162,weight:55,goal:"weight_gain"} },
  { input: "27-year-old female, 160 cm, 58 kg, maintain fitness.", expected: {age:27,gender:"female",height:160,weight:58,goal:"weight_maintenance"} },
  { input: "I am a 36-year-old male, weighing 56 kg at 172 cm, and I want to gain weight while doing light jogging 3 times a week.", expected: {age:36,gender:"male",height:172,weight:56,goal:"weight_gain"} },
  { input: "Female, 27, 162 cm, 58 kg, goal: fat reduction, activity: walking daily.", expected: {age:27,gender:"female",height:162,weight:58,goal:"weight_loss"} },
  { input: "Woman, 45, 165 cm, 70 kg, aim: maintain weight, activity: Pilates twice a week.", expected: {age:45,gender:"female",height:165,weight:70,goal:"weight_maintenance"} },
  { input: "I am a 33-year-old female, 162 cm, 60 kg, want to tone muscles, currently swimming twice a week.", expected: {age:33,gender:"female",height:162,weight:60,goal:"toning"} },
  { input: "40-year-old man, 185 cm, 92 kg, goal: lose belly fat, doing weightlifting 4 times weekly.", expected: {age:40,gender:"male",height:185,weight:92,goal:"weight_loss"} },
  { input: "28-year-old female, 160 cm, 55 kg, want to gain weight, currently walking daily.", expected: {age:28,gender:"female",height:160,weight:55,goal:"weight_gain"} },
  { input: "Male, 35, 180 cm, 88 kg, goal: fat reduction, activity: desk job, little exercise.", expected: {age:35,gender:"male",height:180,weight:88,goal:"weight_loss"} },
  { input: "Female, 27, 160 cm, 53 kg, goal: increase weight, activity: cycling daily.", expected: {age:27,gender:"female",height:160,weight:53,goal:"weight_gain"} },
  { input: "Woman, 25 years, 165 cm, 56 kg, goal: muscle tone, currently jogging.", expected: {age:25,gender:"female",height:165,weight:56,goal:"toning"} },
  { input: "39-year-old woman, 162 cm, 65 kg, aim: fat reduction, doing dance workouts.", expected: {age:39,gender:"female",height:162,weight:65,goal:"weight_loss"} },
  { input: "Male, 28, 182 cm, 85 kg, goal: maintain fitness, currently swimming.", expected: {age:28,gender:"male",height:182,weight:85,goal:"weight_maintenance"} },
  { input: "44-year-old man, 180 cm, 88 kg, goal: fat reduction, currently cycling on weekends.", expected: {age:44,gender:"male",height:180,weight:88,goal:"weight_loss"} },
  { input: "Woman, 21, 162 cm, 52 kg, goal: gain weight, activity: light exercise.", expected: {age:21,gender:"female",height:162,weight:52,goal:"weight_gain"} },
  { input: "Female, 23, 160 cm, 54 kg, aim: weight gain, activity: jogging.", expected: {age:23,gender:"female",height:160,weight:54,goal:"weight_gain"} },
  { input: "Woman, 28, 164 cm, 58 kg, goal: maintain fitness, currently running and yoga.", expected: {age:28,gender:"female",height:164,weight:58,goal:"weight_maintenance"} },
  { input: "Male, 41 years old, 175 cm, 82 kg, fitness goal: lose belly fat.", expected: {age:41,gender:"male",height:175,weight:82,goal:"weight_loss"} },
  { input: "Female, 22, 52 kg, 165 cm, want to increase weight.", expected: {age:22,gender:"female",height:165,weight:52,goal:"weight_gain"} },
  { input: "35-year-old man, 178 cm, 85 kg, goal is fat reduction.", expected: {age:35,gender:"male",height:178,weight:85,goal:"weight_loss"} },
  { input: "Female, 29, 57 kg, 160 cm, looking for weight maintenance.", expected: {age:29,gender:"female",height:160,weight:57,goal:"weight_maintenance"} },
  { input: "Woman, 31, 165 cm, 63 kg, wants to tone muscles.", expected: {age:31,gender:"female",height:165,weight:63,goal:"toning"} },
  { input: "Female, 40, 68 kg, 162 cm, aim: fat reduction.", expected: {age:40,gender:"female",height:162,weight:68,goal:"weight_loss"} },
  { input: "Female, 23, 160 cm, 50 kg, want to gain weight.", expected: {age:23,gender:"female",height:160,weight:50,goal:"weight_gain"} },
  { input: "I am a 37-year-old female, 70 kg, 165 cm, goal: fitness.", expected: {age:37,gender:"female",height:165,weight:70,goal:"weight_maintenance"} },
  { input: "Female, 22, 50 kg, 158 cm, want to gain weight.", expected: {age:22,gender:"female",height:158,weight:50,goal:"weight_gain"} },
  { input: "I'm a 28-year-old male, 5'9\", 165 lbs, want to bulk.", expected: {age:28,gender:"male",height:175,weight:75,goal:"muscle_gain"} },
  { input: "Female, 32, 5.4 ft, 120 lbs, aim: slim down.", expected: {age:32,gender:"female",height:165,weight:54,goal:"weight_loss"} },
  { input: "25 y/o man, 5.11 ft, 150 lbs, fitness goal: gain muscle.", expected: {age:25,gender:"male",height:180,weight:68,goal:"muscle_gain"} },
  { input: "Woman, 30, 5'5\", 130 lbs, goal: tone body.", expected: {age:30,gender:"female",height:165,weight:59,goal:"toning"} },
  { input: "40 yo male, 6 ft, 180 lbs, looking to lose fat.", expected: {age:40,gender:"male",height:183,weight:82,goal:"weight_loss"} },
  { input: "I'm 22-year-old female, 5'3\", 110 lbs, want to gain weight.", expected: {age:22,gender:"female",height:160,weight:50,goal:"weight_gain"} },
  { input: "Male, 35, height 5.10 ft, weight 175 lbs, goal: strength training.", expected: {age:35,gender:"male",height:178,weight:79,goal:"strength"} },
  { input: "Female, 27, 5'6\", 140 lbs, wants to reduce belly fat.", expected: {age:27,gender:"female",height:168,weight:64,goal:"weight_loss"} },
  { input: "21-year-old man, 5.8 ft, 160 lbs, want to bulk up.", expected: {age:21,gender:"male",height:177,weight:73,goal:"muscle_gain"} },
  { input: "Woman, 38, 5'2\", 115 lbs, fitness goal: lean muscle.", expected: {age:38,gender:"female",height:157,weight:52,goal:"muscle_gain"} },
  { input: "Female, 40, 5.4 ft, 130 lbs, goal: maintain weight.", expected: {age:40,gender:"female",height:165,weight:59,goal:"weight_maintenance"} },
  { input: "28M, 5'10\", 170 lbs, want to build muscle.", expected: {age:28,gender:"male",height:178,weight:77,goal:"muscle_gain"} },
  { input: "F25, 5.5 ft, 120 lbs, goal: lose fat.", expected: {age:25,gender:"female",height:165,weight:54,goal:"weight_loss"} },
  { input: "22F, 5'3\", 110 lbs, want to gain weight.", expected: {age:22,gender:"female",height:160,weight:50,goal:"weight_gain"} }
];

let passed = 0;
let failed = 0;

console.log('Testing PromptParser with critical test cases...\n');

testCases.forEach((test, index) => {
  const result = parser.parse(test.input);
  
  let mismatches = [];
  for (const key in test.expected) {
    if (result[key] !== test.expected[key]) {
      mismatches.push(`${key}: expected ${test.expected[key]}, got ${result[key]}`);
    }
  }
  
  if (mismatches.length === 0) {
    console.log(`✓ Test ${index + 1} PASSED`);
    passed++;
  } else {
    console.log(`✗ Test ${index + 1} FAILED`);
    console.log(`  Input: "${test.input}"`);
    console.log(`  Mismatches: ${mismatches.join(', ')}`);
    failed++;
  }
});

console.log(`\n========================================`);
console.log(`Results: ${passed} passed, ${failed} failed out of ${testCases.length} tests`);
console.log(`Success rate: ${((passed/testCases.length)*100).toFixed(1)}%`);
