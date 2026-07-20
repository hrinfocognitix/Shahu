const Enrollment = require('../src/models/Enrollment');
const Question = require('../src/models/Question');

const id = (suffix) => `507f1f77bcf86cd7994390${suffix}`;

describe('learning model safeguards', () => {
  it('keeps question answers private by default', () => {
    expect(Question.schema.path('correctOption').options.select).toBe(false);
    expect(Question.schema.path('explanation').options.select).toBe(false);
  });

  it('rejects a correct answer that is not one of the available options', async () => {
    const question = new Question({
      course: id('11'),
      subject: id('12'),
      questionText: 'Example?',
      normalizedText: 'example?',
      options: [
        { key: 'A', text: 'One' },
        { key: 'B', text: 'Two' },
      ],
      correctOption: 'C',
    });
    await expect(question.validate()).rejects.toThrow(
      'Correct option must match an available answer option'
    );
  });

  it('rejects duplicate answer option keys', async () => {
    const question = new Question({
      course: id('11'),
      subject: id('12'),
      questionText: 'Example?',
      normalizedText: 'example?',
      options: [
        { key: 'A', text: 'One' },
        { key: 'A', text: 'Two' },
      ],
      correctOption: 'A',
    });
    await expect(question.validate()).rejects.toThrow('Answer option keys must be unique');
  });

  it('rejects enrollment validity dates in reverse order', async () => {
    const enrollment = new Enrollment({
      student: id('13'),
      course: id('11'),
      transaction: id('14'),
      purchaseDate: new Date('2026-01-01'),
      validFrom: new Date('2026-02-01'),
      validUntil: new Date('2026-01-01'),
      validityDays: 30,
    });
    await expect(enrollment.validate()).rejects.toThrow(
      'Valid-until date must be on or after valid-from date'
    );
  });
});
