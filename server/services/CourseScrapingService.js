const cheerio = require('cheerio');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

class CourseScrapingService {
  constructor() {
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
  }

  /**
   * Scrape courses from a Great Courses Plus URL
   * @param {string} url - The URL to scrape courses from
   * @returns {Object} Results containing coursesFound, coursesAdded, coursesSkipped
   */
  async scrapeCourses(url) {
    try {
      console.log(`🔍 Fetching page: ${url}`);
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch webpage: ${response.status}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      let coursesFound = 0;
      let coursesAdded = 0;
      let coursesSkipped = 0;

      // Track found courses to avoid duplicates
      const foundCourses = new Set();

      // Different selectors for different Great Courses page layouts
      const courseSelectors = [
        // Great Courses Plus specific selector - require proper container hierarchy
        'div.dlo-view div.grid-view div.product_t.grid-view__item a',
        'div.dlo-view div.grid-view div.product_t.grid-view__item',
        // Fallback Great Courses selectors with container hierarchy
        'div.dlo-view div.grid-view div.product_t a',
        'div.dlo-view div.grid-view div.product_t',
        // Less specific fallbacks if container structure is different
        'div.grid-view div.product_t.grid-view__item a',
        'div.grid-view div.product_t.grid-view__item',
        'div.product_t.grid-view__item a',
        'div.product_t.grid-view__item',
        // Even more generic fallbacks
        'div.product_t a',
        'div.product_t',
        '.course-card a',
        '.course-card',
        'a[href*="thegreatcoursesplus.com"]',
        'a[href*="wondrium.com"]'
      ];

      console.log(`📄 Page loaded. Title: ${$('title').text()}`);

      // Try each selector until we find courses
      let coursesSelector = null;
      for (const selector of courseSelectors) {
        const elements = $(selector);
        console.log(`🔍 Trying selector "${selector}": found ${elements.length} elements`);
        
        if (elements.length > 0) {
          coursesSelector = selector;
          break;
        }
      }

      if (!coursesSelector) {
        console.log('❌ No courses found with any selector');
        
        // If this is a single course page, try to extract that course
        if (this.isSingleCoursePage(url, $)) {
          console.log('📚 Detected single course page, attempting to extract course info');
          const singleCourseResult = await this.extractSingleCourse(url, $);
          return singleCourseResult;
        }
        
        return {
          success: true,
          message: 'No courses found on this page',
          coursesFound: 0,
          coursesAdded: 0,
          coursesSkipped: 0
        };
      }

      console.log(`✅ Using selector: ${coursesSelector}`);

      // Process each course element
      const courseElements = $(coursesSelector);
      console.log(`📚 Processing ${courseElements.length} course elements`);

      for (let i = 0; i < courseElements.length; i++) {
        const element = courseElements.eq(i);
        
        try {
          const courseUrl = this.extractCourseUrl(element, url);
          
          if (!courseUrl || foundCourses.has(courseUrl)) {
            continue;
          }

          coursesFound++;
          foundCourses.add(courseUrl);

          console.log(`📖 Processing course ${coursesFound}: ${courseUrl}`);

          // Check if course already exists in database
          const existingCourse = await prisma.historyCourse.findUnique({
            where: { url: courseUrl }
          });

          if (existingCourse) {
            console.log(`⏭️  Course already exists: ${existingCourse.title}`);
            coursesSkipped++;
            continue;
          }

          // Extract course information
          const courseInfo = await this.extractCourseInfo(courseUrl);
          
          if (!courseInfo) {
            console.log(`❌ Failed to extract info for: ${courseUrl}`);
            continue;
          }

          // Create course in database
          const course = await prisma.historyCourse.create({
            data: {
              title: courseInfo.title,
              category: courseInfo.category,
              url: courseUrl,
              instructor: courseInfo.instructor,
              thumbnail: courseInfo.thumbnail || 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
              description: courseInfo.description ? courseInfo.description.substring(0, 500) : null,
              completed: false
            }
          });

          console.log(`✅ Added course: ${course.title}`);
          coursesAdded++;

          // Add a small delay to be respectful to the server
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
          console.error(`❌ Error processing course element ${i}:`, error);
          continue;
        }
      }

      console.log(`🎉 Scraping completed: ${coursesFound} found, ${coursesAdded} added, ${coursesSkipped} skipped`);

      return {
        success: true,
        message: 'Course scraping completed',
        coursesFound,
        coursesAdded,
        coursesSkipped
      };

    } catch (error) {
      console.error('❌ Error scraping courses:', error);
      throw new Error(`Failed to scrape courses: ${error.message}`);
    }
  }

  /**
   * Extract course URL from element
   */
  extractCourseUrl(element, baseUrl) {
    let courseUrl = null;
    
    // Try to get URL from href attribute (if element is a link)
    courseUrl = element.attr('href');
    
    // If element is not a link, look for a link within it
    if (!courseUrl) {
      const linkElement = element.find('a').first();
      courseUrl = linkElement.attr('href');
    }
    
    if (!courseUrl) {
      return null;
    }
    
    // Make URL absolute if it's relative
    if (courseUrl.startsWith('/')) {
      const baseUrlObj = new URL(baseUrl);
      courseUrl = `${baseUrlObj.protocol}//${baseUrlObj.host}${courseUrl}`;
    }
    
    // Validate URL format
    if (!courseUrl.includes('thegreatcoursesplus.com') && !courseUrl.includes('wondrium.com')) {
      return null;
    }
    
    return courseUrl;
  }

  /**
   * Check if URL appears to be a single course page
   */
  isSingleCoursePage(url, $) {
    // Check URL pattern for single course
    const singleCoursePattern = /\/[^\/]+$/;
    const urlMatch = url.match(singleCoursePattern) && 
                    !url.includes('/category/') && 
                    !url.includes('/collection/') &&
                    !url.includes('/browse') &&
                    !url.includes('/search');
    
    // Check page content for course indicators
    const hasCourseTitlePattern = $('h1').text().length > 0;
    const hasInstructorInfo = $('.instructor').length > 0 || $('[class*="instructor"]').length > 0;
    
    return urlMatch && (hasCourseTitlePattern || hasInstructorInfo);
  }

  /**
   * Extract single course information from a course page
   */
  async extractSingleCourse(url, $) {
    try {
      const courseInfo = this.parseCourseInfoFromPage($, url);
      
      // Check if course already exists
      const existingCourse = await prisma.historyCourse.findUnique({
        where: { url }
      });

      if (existingCourse) {
        return {
          success: true,
          message: 'Course already exists in database',
          coursesFound: 1,
          coursesAdded: 0,
          coursesSkipped: 1
        };
      }

      // Create course in database
      const course = await prisma.historyCourse.create({
        data: {
          title: courseInfo.title,
          category: courseInfo.category,
          url: url,
          instructor: courseInfo.instructor,
          thumbnail: courseInfo.thumbnail || 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
          description: courseInfo.description ? courseInfo.description.substring(0, 500) : null,
          completed: false
        }
      });

      console.log(`✅ Added single course: ${course.title}`);

      return {
        success: true,
        message: 'Single course added successfully',
        coursesFound: 1,
        coursesAdded: 1,
        coursesSkipped: 0
      };

    } catch (error) {
      console.error('❌ Error extracting single course:', error);
      throw error;
    }
  }

  /**
   * Extract course information from a course URL
   */
  async extractCourseInfo(courseUrl) {
    try {
      console.log(`🔍 Fetching course info from: ${courseUrl}`);
      
      const response = await fetch(courseUrl, {
        headers: {
          'User-Agent': this.userAgent
        }
      });

      if (!response.ok) {
        console.log(`❌ Failed to fetch course page: ${response.status}`);
        return null;
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      return this.parseCourseInfoFromPage($, courseUrl);

    } catch (error) {
      console.error(`❌ Error extracting course info from ${courseUrl}:`, error);
      return null;
    }
  }

  /**
   * Parse course information from a page's DOM
   */
  parseCourseInfoFromPage($, courseUrl) {
    // Extract title
    const title = $('h1').first().text().trim() ||
                 $('title').text().replace(' | The Great Courses Plus', '').replace(' | Wondrium', '').trim() ||
                 courseUrl.split('/').pop().replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    // Define titles to exclude (navigation, policy pages, etc.)
    const excludedTitles = [
      'Marketing Preview Tool',
      'The Great Courses Plus Privacy Policy',
      'Website Terms of Use',
      'All Subjects',
      'Classic Great Courses',
      'Series',
      'Courses',
      'Science',
      'Privacy Policy',
      'Terms of Use',
      'Terms and Conditions'
    ];
    
    // Check if title should be excluded
    const shouldExcludeTitle = excludedTitles.some(excludeTitle => 
      title.toLowerCase().includes(excludeTitle.toLowerCase()) ||
      title.toLowerCase() === excludeTitle.toLowerCase()
    );
    
    if (shouldExcludeTitle) {
      console.log(`🚫 Excluding course with title: "${title}"`);
      return null;
    }

    // Extract description
    const description = $('meta[name="description"]').attr('content') ||
                       $('.course-description').text().trim() ||
                       $('.description').text().trim() ||
                       'Description not available';

    // Extract instructor
    const instructor = $('.instructor-name').text().trim() ||
                      $('.instructor').text().trim() ||
                      'The Great Courses';

    // Determine category based on URL or page content
    let category = 'General';
    if (courseUrl.includes('history') || title.toLowerCase().includes('history')) {
      if (title.toLowerCase().includes('ancient')) {
        category = 'Ancient History';
      } else if (title.toLowerCase().includes('medieval') || title.toLowerCase().includes('renaissance')) {
        category = 'Medieval & Renaissance History';
      } else {
        category = 'History';
      }
    } else if (courseUrl.includes('culture') || title.toLowerCase().includes('culture') || title.toLowerCase().includes('civilization')) {
      category = 'Civilization & Culture';
    }

    return {
      title,
      description,
      instructor,
      category
    };
  }

  /**
   * Scrape videos for a specific course
   */
  async scrapeVideosForCourse(course) {
    try {
      console.log(`🎥 Scraping videos for course: ${course.title}`);
      
      const response = await fetch(course.url, {
        headers: {
          'User-Agent': this.userAgent
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch course page: ${response.status}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      const videos = [];
      let videosAdded = 0;
      let videosSkipped = 0;

      // Find all lecture sections - they appear as h4 elements with lecture numbers
      $('h4').each((index, element) => {
        const lectureText = $(element).text().trim();
        
        // Look for patterns like "Lecture 1:", "1.", etc.
        const lectureMatch = lectureText.match(/(?:lecture\s*)?(\d+)[\.:]\s*(.+)/i);
        
        if (lectureMatch) {
          const lectureNumber = parseInt(lectureMatch[1]);
          const lectureTitle = lectureMatch[2].trim();
          
          // Create a video URL (this is a placeholder - actual implementation would need
          // to find the real video URLs from the page)
          const videoUrl = `${course.url}/lecture-${lectureNumber}`;
          
          videos.push({
            title: `Lecture ${lectureNumber}: ${lectureTitle}`,
            url: videoUrl,
            description: `Lecture ${lectureNumber} from ${course.title}`,
            order: lectureNumber,
            courseId: course.id
          });
        }
      });

      // Create videos in database
      for (const videoData of videos) {
        try {
          // Check if video already exists
          const existingVideo = await prisma.historyCourseVideo.findUnique({
            where: { url: videoData.url }
          });

          if (existingVideo) {
            console.log(`⏭️  Video already exists: ${videoData.title}`);
            videosSkipped++;
            continue;
          }

          await prisma.historyCourseVideo.create({
            data: {
              ...videoData,
              watched: false
            }
          });

          console.log(`✅ Added video: ${videoData.title}`);
          videosAdded++;

        } catch (error) {
          console.error(`❌ Error adding video ${videoData.title}:`, error);
        }
      }

      console.log(`🎉 Video scraping completed: ${videosAdded} added, ${videosSkipped} skipped`);

      return {
        success: true,
        message: 'Video scraping completed',
        videosFound: videos.length,
        videosAdded,
        videosSkipped
      };

    } catch (error) {
      console.error('❌ Error scraping course videos:', error);
      throw new Error(`Failed to scrape course videos: ${error.message}`);
    }
  }
}

module.exports = CourseScrapingService;