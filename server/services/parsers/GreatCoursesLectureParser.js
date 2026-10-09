const cheerio = require('cheerio');

function parseGreatCoursesLectures(html, course) {
  const $ = cheerio.load(html);
  const lectures = new Map();

  const addLecture = (text, container, explicitOrder) => {
    const match = text.replace(/\s+/g, ' ').trim().match(/^(?:lecture\s*)?(\d+)[.:]\s*(.+)$/i);
    if (!match) return;

    const order = explicitOrder === undefined ? Number(match[1]) : Number(explicitOrder);
    if (!Number.isSafeInteger(order) || order <= 0 || lectures.has(order)) return;

    const url = new URL(course.url);
    url.hash = '';
    url.searchParams.set('lecplay', String(order));
    const description = container.find('.media-body p').first().text().trim() ||
      container.find('p').first().text().trim() ||
      `Lecture ${order} from ${course.title}`;

    lectures.set(order, {
      title: `Lecture ${order}: ${match[2].trim()}`,
      url: url.toString(),
      description,
      order,
      courseId: course.id
    });
  };

  $('#lectures-list .play-lecture[data-idx], .lectures-list .play-lecture[data-idx]').each((index, element) => {
    const lecture = $(element);
    const row = lecture.closest('.media');
    addLecture(lecture.attr('data-title') || row.find('h2,h3,h4,h5,h6').first().text(), row, lecture.attr('data-idx'));
  });

  // Older pages render numbered lecture headings without the playback data attributes.
  const lectureLists = $('#lectures-list, .lectures-list');
  const headings = lectureLists.length
    ? lectureLists.find('h2,h3,h4,h5,h6')
    : $('h3,h4');
  headings.each((index, element) => {
    const heading = $(element);
    const row = heading.closest('.media');
    addLecture(heading.text(), row.length ? row : heading.parent());
  });

  return [...lectures.values()].sort((first, second) => first.order - second.order);
}

module.exports = { parseGreatCoursesLectures };
