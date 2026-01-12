import { parsePrompt } from './promptParser';

describe('promptParser', () => {
  test('parses basic profile information', () => {
    const prompt = 'I am a 30-year-old male, 175 cm tall, weighing 80 kg. I want to build muscle.';
    const result = parsePrompt(prompt);
    
    expect(result.age).toBe(30);
    expect(result.gender).toBe('male');
    expect(result.height).toBe(175);
    expect(result.weight).toBe(80);
    expect(result.goal).toBe('muscle_gain');
  });

  test('parses shorthand format with gender and age', () => {
    const prompt = '28M, 5\'9", 160 lbs, want to lose weight';
    const result = parsePrompt(prompt);
    
    expect(result.age).toBe(28);
    expect(result.gender).toBe('male');
    expect(result.height).toBe(175); // 5'9" = 175 cm
    expect(result.weight).toBe(73); // 160 lbs = 73 kg
    expect(result.goal).toBe('weight_loss');
  });

  test('parses activity level and frequency', () => {
    const prompt = 'I do moderate activity and work out 5 times per week';
    const result = parsePrompt(prompt);
    
    expect(result.activityLevel).toBe('moderately active');
    expect(result.frequency).toBe(5);
  });

  test('parses target weight and timeline', () => {
    const prompt = 'My target weight is 70 kg and I want to achieve this in 3 months';
    const result = parsePrompt(prompt);
    
    expect(result.targetWeight.value).toBe(70);
    expect(result.timeline.value).toBe(12); // 3 months = 12 weeks
    expect(result.timeline.unit).toBe('weeks');
  });

  test('handles imperial units correctly', () => {
    const prompt = '5\'5" and 130 pounds';
    const result = parsePrompt(prompt);
    
    expect(result.height).toBe(165); // 5'5" = 165 cm
    expect(result.weight).toBe(59); // 130 lbs = 59 kg
  });

  test('parses weight change goals', () => {
    const prompt = 'I want to lose 10 kg';
    const result = parsePrompt(prompt);
    
    expect(result.weightChange.value).toBeLessThan(0); // Negative for loss
    expect(Math.abs(result.weightChange.value)).toBe(10);
  });

  test('handles edge cases gracefully', () => {
    const prompt = '';
    const result = parsePrompt(prompt);
    
    // Should return default structure with null values
    expect(result).toBeDefined();
    expect(result.age).toBeNull();
    expect(result.gender).toBeNull();
  });
});