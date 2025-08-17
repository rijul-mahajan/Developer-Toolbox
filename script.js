// Load tools from JSON
let tools = [];

// Fetch tools from JSON file
async function loadTools() {
  try {
    const response = await fetch("tools.json");
    tools = await response.json();
  } catch (error) {
    console.error("Error loading tools:", error);
  }
}

// State
let currentFilter = "all";
let currentPriceFilter = null;
let searchQuery = "";
let bookmarks = JSON.parse(localStorage.getItem("devtoolbox-bookmarks")) || [];
let showingBookmarksView = false;
let selectedProjectTypes = [];

// DOM Elements
const toolsGrid = document.getElementById("toolsGrid");
const searchInput = document.getElementById("searchInput");
const filterTags = document.querySelectorAll(".filter-tag[data-filter]");
const priceFilters = document.querySelectorAll(".filter-tag[data-price]");
const suggestToolModal = document.getElementById("suggestToolModal");
const suggestToolBtn = document.getElementById("suggestTool");
const closeModalBtn = document.getElementById("closeModal");
const suggestToolForm = document.getElementById("suggestToolForm");
const recommendationsModal = document.getElementById("recommendationsModal");
const getRecommendationsBtn = document.getElementById("getRecommendations");
const closeRecommendationsModalBtn = document.getElementById(
  "closeRecommendationsModal"
);

// Initialize
async function init() {
  await loadTools();
  calculateStats();
  animateCounters();
  renderTools();
  setupEventListeners();
  setupKeyboardShortcuts();
  setupBackToTop();
  setupRecommendationsModal();
}

function animateCounters() {
  const counters = document.querySelectorAll(".stat-number");

  counters.forEach((counter) => {
    const target = parseInt(counter.getAttribute("data-target"));
    const duration = 1000; // 1s
    const increment = target / (duration / 16); // 60fps
    let current = 0;

    const updateCounter = () => {
      if (current < target) {
        current += increment;
        counter.textContent = Math.floor(current);
        requestAnimationFrame(updateCounter);
      } else {
        counter.textContent = target;
      }
    };

    updateCounter();
  });
}

// Calculate dynamic stats
function calculateStats() {
  const totalTools = tools.length;
  const freeTools = tools.filter(
    (tool) => tool.price === "free" || tool.price === "open-source"
  ).length;
  const categories = [...new Set(tools.map((tool) => tool.category))].length;

  // Update data-target attributes
  document
    .querySelector('.stat-number[data-target="1000"]')
    .setAttribute("data-target", totalTools);
  document
    .querySelector('.stat-number[data-target="750"]')
    .setAttribute("data-target", freeTools);
  document
    .querySelector('.stat-number[data-target="100"]')
    .setAttribute("data-target", categories);
}

// Render tools
function renderTools() {
  let filteredTools;

  if (showingBookmarksView) {
    // Show only bookmarked tools
    filteredTools = tools.filter((tool) => bookmarks.includes(tool.id));
  } else {
    if (searchQuery.trim() === "") {
      // No search query - apply regular filters
      filteredTools = tools.filter((tool) => {
        const matchesCategory =
          currentFilter === "all" || tool.category === currentFilter;
        const matchesPrice =
          !currentPriceFilter || tool.price === currentPriceFilter;
        return matchesCategory && matchesPrice;
      });
    } else {
      // Search with prioritization
      const searchTerm = searchQuery.toLowerCase().trim();

      // Create scored results
      const scoredTools = tools
        .map((tool) => {
          let score = 0;
          const toolName = tool.name.toLowerCase();
          const toolDescription = tool.description.toLowerCase();
          const toolCategory = tool.category.toLowerCase();
          const toolBadges = tool.badges
            .map((badge) => badge.toLowerCase())
            .join(" ");

          // Priority 1: Tool Name matches (highest priority)
          if (toolName === searchTerm) {
            score += 1000; // Exact match gets highest score
          } else if (toolName.startsWith(searchTerm)) {
            score += 500; // Starts with gets high score
          } else if (toolName.includes(searchTerm)) {
            score += 300; // Contains gets medium-high score
          }

          // Priority 2: Badge matches
          if (toolBadges.includes(searchTerm)) {
            score += 200; // Exact badge match
          } else if (toolBadges.includes(searchTerm)) {
            score += 150; // Badge contains search term
          }

          // Priority 3: Description matches (lower priority)
          if (toolDescription.includes(searchTerm)) {
            score += 100;
          }

          // Priority 4: Category matches (lowest priority)
          if (toolCategory.includes(searchTerm)) {
            score += 50;
          }

          // Only return tools that actually match the search
          if (score > 0) {
            return { tool, score };
          }
          return null;
        })
        .filter(Boolean) // Remove null results
        .sort((a, b) => b.score - a.score) // Sort by score descending
        .map(({ tool }) => tool); // Extract just the tool objects

      // Apply additional filters to search results
      filteredTools = scoredTools.filter((tool) => {
        const matchesCategory =
          currentFilter === "all" || tool.category === currentFilter;
        const matchesPrice =
          !currentPriceFilter || tool.price === currentPriceFilter;
        return matchesCategory && matchesPrice;
      });
    }
  }

  toolsGrid.innerHTML = filteredTools
    .map(
      (tool) => `
                <div class="tool-card" data-id="${tool.id}">
                    <div class="tool-header">
                        <div class="tool-logo">${tool.logo}</div>
                        <div class="tool-info">
                            <h3 class="tool-name">${tool.name}</h3>
                            <div class="tool-category">${tool.category.toUpperCase()}</div>
                        </div>
                    </div>
                    <p class="tool-description">${tool.description}</p>
                    <div class="tool-footer">
                        <div class="tool-badges">
                            ${tool.badges
                              .map(
                                (badge) =>
                                  `<span class="badge ${
                                    badge.toLowerCase() === "popular"
                                      ? "popular"
                                      : ""
                                  }">${badge}</span>`
                              )
                              .join("")}
                        </div>
                        <div class="tool-actions">
                            <a href="${
                              tool.url
                            }" class="tool-link" target="_blank" rel="noopener">
                                Visit Tool
                                <i class="fas fa-external-link-alt"></i>
                            </a>
                            <button class="bookmark-btn ${
                              bookmarks.includes(tool.id) ? "bookmarked" : ""
                            }" 
                                    onclick="toggleBookmark(${tool.id})">
                                <i class="fas fa-bookmark"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `
    )
    .join("");

  // Show empty state for bookmarks if needed
  if (showingBookmarksView && filteredTools.length === 0) {
    toolsGrid.innerHTML = `
      <div class="bookmarks-empty" style="grid-column: 1 / -1;">
        <i class="fas fa-bookmark"></i>
        <h3>No bookmarks yet</h3>
        <p>Start bookmarking your favorite tools to see them here!</p>
      </div>
    `;
  }

  // Show empty state for search results if needed
  if (
    !showingBookmarksView &&
    filteredTools.length === 0 &&
    (searchQuery || currentFilter !== "all" || currentPriceFilter)
  ) {
    toolsGrid.innerHTML = `
    <div class="search-empty" style="grid-column: 1 / -1;">
      <i class="fas fa-search"></i>
      <h3>No tools found</h3>
      <p>Try adjusting your search criteria or filters to find what you're looking for.</p>
      <button onclick="clearFilters()" class="clear-filters-btn btn-primary">Clear all filters</button>
    </div>
  `;
  }
}

// Generate and maintain simple tools list
function downloadToolsList() {
  const list = tools.map((tool) => tool.name.toLowerCase().trim());
  const blob = new Blob([list.join("\n")], { type: "text/plain" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "tools-list.txt";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return list;
}

// Check if tool exists (case-insensitive)
function toolExists(toolName) {
  const toolsList = tools.map((tool) => tool.name.toLowerCase().trim());
  return toolsList.includes(toolName.toLowerCase().trim());
}

// Find duplicates in current tools array
function findDuplicates() {
  const toolsList = tools.map((tool) => tool.name.toLowerCase().trim());
  const duplicates = [];
  const seen = new Set();

  toolsList.forEach((name) => {
    if (seen.has(name)) {
      duplicates.push(name);
    } else {
      seen.add(name);
    }
  });

  return duplicates;
}

// Helper function to clear all filters
function clearFilters() {
  // Reset all filter states
  currentFilter = "all";
  currentPriceFilter = null;
  searchQuery = "";
  showingBookmarksView = false;

  // Reset UI
  searchInput.value = "";
  filterTags.forEach((tag) => tag.classList.remove("active"));
  document.querySelector('[data-filter="all"]').classList.add("active");
  priceFilters.forEach((tag) => tag.classList.remove("active"));

  // Re-render tools
  renderTools();
}

// Toggle bookmark
function toggleBookmark(toolId) {
  const index = bookmarks.indexOf(toolId);
  if (index > -1) {
    bookmarks.splice(index, 1);
  } else {
    bookmarks.push(toolId);
  }
  localStorage.setItem("devtoolbox-bookmarks", JSON.stringify(bookmarks));
  renderTools();
}

// Bookmarks view functionality
function showBookmarksView() {
  showingBookmarksView = true;

  // Update filter tags
  filterTags.forEach((tag) => tag.classList.remove("active"));
  document.querySelector('[data-filter="bookmarks"]').classList.add("active");

  // Clear other filters
  currentFilter = "all";
  currentPriceFilter = null;
  searchQuery = "";
  searchInput.value = "";
  priceFilters.forEach((tag) => tag.classList.remove("active"));

  renderTools();
}

function hideBookmarksView() {
  showingBookmarksView = false;

  // Reset to "All" filter
  filterTags.forEach((tag) => tag.classList.remove("active"));
  document.querySelector('[data-filter="all"]').classList.add("active");

  renderTools();
}

// Add clear all bookmarks functionality
function clearAllBookmarks() {
  if (bookmarks.length === 0) return;

  if (confirm("Are you sure you want to clear all bookmarks?")) {
    bookmarks = [];
    localStorage.setItem("devtoolbox-bookmarks", JSON.stringify(bookmarks));
    renderTools();
  }
}

// Debounce function for search optimization
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function smoothScrollTo(target, duration = 800) {
  const targetElement =
    typeof target === "string" ? document.querySelector(target) : target;
  const targetPosition = targetElement ? targetElement.offsetTop : 0;
  const startPosition = window.pageYOffset;
  const distance = targetPosition - startPosition;
  let startTime = null;

  function animation(currentTime) {
    if (startTime === null) startTime = currentTime;
    const timeElapsed = currentTime - startTime;
    const run = easeInOutCubic(timeElapsed, startPosition, distance, duration);
    window.scrollTo(0, run);
    if (timeElapsed < duration) requestAnimationFrame(animation);
  }

  function easeInOutCubic(t, b, c, d) {
    t /= d / 2;
    if (t < 1) return (c / 2) * t * t * t + b;
    t -= 2;
    return (c / 2) * (t * t * t + 2) + b;
  }

  requestAnimationFrame(animation);
}

// Create back-to-top button
function createBackToTopButton() {
  const backToTopBtn = document.createElement("button");
  backToTopBtn.className = "back-to-top";
  backToTopBtn.innerHTML = '<i class="fas fa-arrow-up"></i>';
  backToTopBtn.setAttribute("aria-label", "Back to top");
  document.body.appendChild(backToTopBtn);

  return backToTopBtn;
}

// Handle back-to-top visibility and functionality
function setupBackToTop() {
  const backToTopBtn = createBackToTopButton();

  // Show/hide button based on scroll position
  const toggleVisibility = () => {
    if (window.pageYOffset > 300) {
      backToTopBtn.classList.add("visible");
    } else {
      backToTopBtn.classList.remove("visible");
    }
  };

  // Throttle scroll event for performance
  let ticking = false;
  const handleScroll = () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        toggleVisibility();
        ticking = false;
      });
      ticking = true;
    }
  };

  window.addEventListener("scroll", handleScroll);

  // Click handler for smooth scroll to top
  backToTopBtn.addEventListener("click", () => {
    smoothScrollTo(document.body);
  });
}

// Debounced search function
const debouncedSearch = debounce((query) => {
  searchQuery = query;
  renderTools();
}, 300);

// Setup event listeners
function setupEventListeners() {
  // Search
  searchInput.addEventListener("input", (e) => {
    debouncedSearch(e.target.value);
  });

  // Scroll to top
  const logo = document.querySelector(".logo");
  logo.addEventListener("click", (e) => {
    e.preventDefault();
    smoothScrollTo(document.body);
  });

  // Category filters
  filterTags.forEach((tag) => {
    tag.addEventListener("click", () => {
      if (tag.dataset.filter === "bookmarks") {
        // Handle bookmarks view
        if (showingBookmarksView) {
          // If already showing bookmarks, go back to all
          hideBookmarksView();
        } else {
          // Show bookmarks view
          showBookmarksView();
        }
      } else if (tag.dataset.filter === "all") {
        filterTags.forEach((t) => t.classList.remove("active"));
        tag.classList.add("active");
        currentFilter = "all";
        showingBookmarksView = false;
        renderTools();
      } else {
        // Toggle behavior for other filters
        showingBookmarksView = false;
        if (tag.classList.contains("active")) {
          // If clicking active filter, go back to 'All'
          tag.classList.remove("active");
          filterTags.forEach((t) => {
            if (t.dataset.filter === "all") {
              t.classList.add("active");
            } else {
              t.classList.remove("active");
            }
          });
          currentFilter = "all";
        } else {
          // If clicking inactive filter, activate it and deactivate others
          filterTags.forEach((t) => t.classList.remove("active"));
          tag.classList.add("active");
          currentFilter = tag.dataset.filter;
        }
        renderTools();
      }
    });
  });

  // Price filters
  priceFilters.forEach((tag) => {
    tag.addEventListener("click", () => {
      if (showingBookmarksView) return;

      if (tag.classList.contains("active")) {
        tag.classList.remove("active");
        currentPriceFilter = null;
      } else {
        priceFilters.forEach((t) => t.classList.remove("active"));
        tag.classList.add("active");
        currentPriceFilter = tag.dataset.price;
      }
      renderTools();
    });
  });

  // Custom Select functionality
  const selectButton = document.getElementById("selectButton");
  const selectDropdown = document.getElementById("selectDropdown");
  const selectValue = document.getElementById("selectValue");
  const selectOptions = document.querySelectorAll(".select-option");
  const hiddenInput = document.getElementById("toolCategory");

  selectButton.addEventListener("click", (e) => {
    e.preventDefault();
    selectButton.classList.toggle("active");
    selectDropdown.classList.toggle("active");
  });

  selectOptions.forEach((option) => {
    option.addEventListener("click", () => {
      const value = option.dataset.value;
      const text = option.textContent;

      selectValue.textContent = text;
      selectButton.classList.remove("placeholder", "active");
      selectDropdown.classList.remove("active");
      hiddenInput.value = value;
    });
  });

  // Close dropdown when clicking outside
  document.addEventListener("click", (e) => {
    if (
      !selectButton.contains(e.target) &&
      !selectDropdown.contains(e.target)
    ) {
      selectButton.classList.remove("active");
      selectDropdown.classList.remove("active");
    }
  });

  // Modal controls
  suggestToolBtn.addEventListener("click", (e) => {
    e.preventDefault();
    suggestToolModal.classList.add("active");
    document.body.style.overflow = "hidden";
  });

  const closeModal = () => {
    suggestToolModal.classList.remove("active");
    document.body.style.overflow = "";
  };

  closeModalBtn.addEventListener("click", closeModal);

  suggestToolModal.addEventListener("click", (e) => {
    if (e.target === suggestToolModal) {
      closeModal();
    }
  });

  // Google Form configuration
  const GOOGLE_FORM_URL =
    "https://docs.google.com/forms/d/e/1FAIpQLSfE1oSG7RHEnSA2RGYLP-2VJEU5eGvA8dsaUqHrtqIgMdKwXA/formResponse";

  const FORM_ENTRIES = {
    toolName: "entry.1806715086",
    toolDescription: "entry.441835730",
    toolCategory: "entry.1645444266",
    toolUrl: "entry.669532944",
  };

  // Form element submission method
  function submitWithFormElement(toolData) {
    return new Promise((resolve) => {
      // Create hidden iframe
      const iframe = document.createElement("iframe");
      iframe.name = "hiddenFrame";
      iframe.style.display = "none";
      document.body.appendChild(iframe);

      const form = document.createElement("form");
      form.method = "POST";
      form.action = GOOGLE_FORM_URL;
      form.target = "hiddenFrame";
      form.style.display = "none";

      const fields = [
        { name: FORM_ENTRIES.toolName, value: toolData.name },
        { name: FORM_ENTRIES.toolDescription, value: toolData.description },
        { name: FORM_ENTRIES.toolCategory, value: toolData.category },
        { name: FORM_ENTRIES.toolUrl, value: toolData.url },
      ];

      fields.forEach((field) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = field.name;
        input.value = field.value;
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();

      setTimeout(() => {
        // Clean up
        if (form.parentNode) {
          document.body.removeChild(form);
        }
        if (iframe.parentNode) {
          document.body.removeChild(iframe);
        }
        resolve(true);
      }, 1000);
    });
  }

  // Form submission handler
  suggestToolForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const toolData = {
      name: document.getElementById("toolName").value.trim(),
      description: document.getElementById("toolDescription").value.trim(),
      category: document.getElementById("toolCategory").value.trim(),
      url: document.getElementById("toolUrl").value.trim(),
    };

    // Validation
    if (
      !toolData.name ||
      !toolData.description ||
      !toolData.category ||
      !toolData.url
    ) {
      alert("Please fill in all fields.");
      return;
    }

    // Check for duplicates
    if (toolExists(toolData.name)) {
      alert(`A tool named "${toolData.name}" already exists in the directory.`);
      return;
    }

    // URL validation
    try {
      new URL(toolData.url);
    } catch {
      alert("Please enter a valid URL (including http:// or https://)");
      return;
    }

    // Show loading state
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Submitting...';
    submitBtn.disabled = true;

    try {
      await submitWithFormElement(toolData);
    } catch (error) {
      console.error("Submission error:", error);
    }

    // Restore button
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;

    // Show success message
    alert(
      "Thank you for your suggestion! We'll review it and add it to our directory soon."
    );

    // Reset form
    e.target.reset();

    // Reset custom select
    const selectValue = document.getElementById("selectValue");
    const selectButton = document.getElementById("selectButton");
    if (selectValue && selectButton) {
      selectValue.textContent = "Select a category";
      selectButton.classList.add("placeholder");
    }
    document.getElementById("toolCategory").value = "";

    // Close modal
    const suggestToolModal = document.getElementById("suggestToolModal");
    if (suggestToolModal) {
      suggestToolModal.classList.remove("active");
    }
  });
}

// Setup keyboard shortcuts
function setupKeyboardShortcuts() {
  document.addEventListener("keydown", (e) => {
    // Focus search with '/'
    if (
      e.key === "/" &&
      e.target !== searchInput &&
      !suggestToolModal.classList.contains("active") &&
      !recommendationsModal.classList.contains("active")
    ) {
      e.preventDefault();
      searchInput.focus();
    }

    // Close modals with Escape
    if (e.key === "Escape") {
      suggestToolModal.classList.remove("active");
      recommendationsModal.classList.remove("active");
      document.body.style.overflow = "";
    }
  });
}

// AI Recommendations System
function setupRecommendationsModal() {
  const projectTypeTags = document.querySelectorAll(".project-type-tag");
  const experienceSelectButton = document.getElementById(
    "experienceSelectButton"
  );
  const experienceSelectDropdown = document.getElementById(
    "experienceSelectDropdown"
  );
  const experienceSelectValue = document.getElementById(
    "experienceSelectValue"
  );
  const experienceSelectOptions =
    experienceSelectDropdown.querySelectorAll(".select-option");
  const experienceLevel = document.getElementById("experienceLevel");

  // Project type selection
  projectTypeTags.forEach((tag) => {
    tag.addEventListener("click", () => {
      const type = tag.dataset.type;
      if (selectedProjectTypes.includes(type)) {
        selectedProjectTypes = selectedProjectTypes.filter((t) => t !== type);
        tag.classList.remove("active");
      } else {
        selectedProjectTypes.push(type);
        tag.classList.add("active");
      }
    });
  });

  // Experience level select
  experienceSelectButton.addEventListener("click", (e) => {
    e.preventDefault();
    experienceSelectButton.classList.toggle("active");
    experienceSelectDropdown.classList.toggle("active");
  });

  experienceSelectOptions.forEach((option) => {
    option.addEventListener("click", () => {
      const value = option.dataset.value;
      const text = option.textContent;

      experienceSelectValue.textContent = text;
      experienceSelectButton.classList.remove("placeholder", "active");
      experienceSelectDropdown.classList.remove("active");
      experienceLevel.value = value;
    });
  });

  document.addEventListener("click", (e) => {
    if (
      !experienceSelectButton.contains(e.target) &&
      !experienceSelectDropdown.contains(e.target)
    ) {
      experienceSelectButton.classList.remove("active");
      experienceSelectDropdown.classList.remove("active");
    }
  });

  // Generate recommendations
  document
    .getElementById("generateRecommendations")
    .addEventListener("click", generateRecommendations);

  // New recommendation button
  document.getElementById("newRecommendation").addEventListener("click", () => {
    document.querySelector(".recommendations-form").style.display = "block";
    document.getElementById("recommendationsResults").style.display = "none";
  });

  // Modal controls
  getRecommendationsBtn.addEventListener("click", (e) => {
    e.preventDefault();
    recommendationsModal.classList.add("active");
    document.body.style.overflow = "hidden";
  });

  const closeRecommendationsModal = () => {
    recommendationsModal.classList.remove("active");
    document.body.style.overflow = "";
  };

  closeRecommendationsModalBtn.addEventListener(
    "click",
    closeRecommendationsModal
  );

  recommendationsModal.addEventListener("click", (e) => {
    if (e.target === recommendationsModal) {
      closeRecommendationsModal();
    }
  });
}

// Get simple list of tool names for LLM
function getToolNamesList() {
  return tools.map((tool) => tool.name).join(", ");
}

// Gemini API Query Function
async function queryLLM(prompt) {
  try {
    const response = await fetch("/api/recommendations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Backend API Error");
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || "Failed to get recommendations");
    }

    return data.recommendations;
  } catch (error) {
    console.error("Backend API error:", error);
    throw new Error("Failed to get AI recommendations: " + error.message);
  }
}

// Create prompt for LLM
function generatePrompt(
  projectDescription,
  experienceLevel,
  selectedProjectTypes,
  availableTools
) {
  const availableCategories = Object.keys(categoryTitle).join(", ");

  return `You are an expert software development consultant. Based on the project description and experience level, recommend the BEST tools for this project.

PROJECT DETAILS:
- Description: ${projectDescription}
- Experience Level: ${experienceLevel}
- Project Types: ${selectedProjectTypes.join(", ") || "General development"}

AVAILABLE TOOLS TO CHOOSE FROM:
${availableTools}

AVAILABLE CATEGORIES (use these exact lowercase keys):
${availableCategories}

CRITICAL INSTRUCTIONS:
1. Recommend 8-12 tools total across different categories
2. NEVER recommend the same tool in multiple categories
3. Each tool should appear only ONCE in the entire response
4. Consider the developer's experience level (${experienceLevel})
5. For tools from our directory: Use exact tool names and mark inDirectory: true
6. For external tools (not in our directory):
   - Use ONLY the tool name without any parentheses, versions, or extra text
   - Provide the official website URL
   - Keep descriptions concise and professional
7. Use ONLY the available category keys provided above
8. Provide specific reasons why each tool fits this project
9. IMPORTANT: Before marking any tool as external, check if a similar tool exists in our directory (e.g., "Tailwind" should match "Tailwind CSS")

RESPONSE FORMAT (EXAMPLE) - Follow this EXACT JSON structure:
{
  "frontend": [
    {"name": "React", "reason": "Perfect for building interactive UIs with component-based architecture", "inDirectory": true}
  ],
  "backend": [
    {"name": "Express", "reason": "Minimal web framework for Node.js applications", "inDirectory": true}
  ],
  "database": [
    {"name": "MongoDB", "reason": "Flexible NoSQL database for rapid development", "inDirectory": false, "url": "https://www.mongodb.com"}
  ]
}`;
}

// Generate recommendations
async function generateRecommendations() {
  const projectDescription = document
    .getElementById("projectDescription")
    .value.trim();
  const experienceLevel = document.getElementById("experienceLevel").value;

  if (!projectDescription) {
    alert("Please describe what you're planning to build.");
    return;
  }

  if (!experienceLevel) {
    alert("Please select your experience level.");
    return;
  }

  // Show loading state
  const generateBtn = document.getElementById("generateRecommendations");
  const originalText = generateBtn.innerHTML;
  generateBtn.innerHTML =
    '<i class="fas fa-spinner fa-spin"></i> Getting AI recommendations...';
  generateBtn.disabled = true;

  try {
    // Get available tool names
    const availableTools = getToolNamesList();

    // Create improved prompt
    const prompt = generatePrompt(
      projectDescription,
      experienceLevel,
      selectedProjectTypes,
      availableTools
    );

    const recommendations = await queryLLM(prompt);

    // Validate and clean recommendations
    const cleanedRecommendations =
      validateAndCleanRecommendations(recommendations);

    displayRecommendations(cleanedRecommendations);

    // Hide form and show results
    document.querySelector(".recommendations-form").style.display = "none";
    document.getElementById("recommendationsResults").style.display = "block";
  } catch (error) {
    console.error("Error generating recommendations:", error);
    alert("Error generating recommendations. Please try again later.");
  } finally {
    // Restore button
    generateBtn.innerHTML = originalText;
    generateBtn.disabled = false;
  }
}

// Validate and clean recommendations
function validateAndCleanRecommendations(recommendations) {
  const seenTools = new Set();
  const cleanedRecommendations = {};

  // Create a lookup map for fuzzy matching
  const toolsLookup = new Map();
  tools.forEach((tool) => {
    const normalizedName = tool.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    toolsLookup.set(normalizedName, tool);
    // Also add common variations
    toolsLookup.set(tool.name.toLowerCase(), tool);
  });

  Object.entries(recommendations).forEach(([category, categoryTools]) => {
    if (!categoryTools || !Array.isArray(categoryTools)) return;

    const cleanedCategoryTools = [];

    categoryTools.forEach((tool) => {
      if (!tool || !tool.name) return;

      // Clean tool name - remove parentheses and extra text
      let cleanName = tool.name.trim();
      cleanName = cleanName.replace(/\s*\([^)]*\)/g, "");
      cleanName = cleanName.replace(/\s+v?\d+(\.\d+)*\s*$/i, "");
      cleanName = cleanName.replace(/\s+(framework|library|tool|js|css)$/i, "");
      cleanName = cleanName.trim();

      // Check for duplicates (case-insensitive)
      const toolKey = cleanName.toLowerCase();
      if (seenTools.has(toolKey)) {
        console.warn(`Duplicate tool detected and skipped: ${cleanName}`);
        return;
      }

      seenTools.add(toolKey);

      // Intelligent matching for directory tools
      let matchedTool = null;
      const normalizedCleanName = cleanName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");

      // Try exact match first
      matchedTool = toolsLookup.get(cleanName.toLowerCase());

      // Try normalized match
      if (!matchedTool) {
        matchedTool = toolsLookup.get(normalizedCleanName);
      }

      // Try partial matches for common cases
      if (!matchedTool) {
        for (const [key, toolData] of toolsLookup) {
          if (
            key.includes(normalizedCleanName) ||
            normalizedCleanName.includes(key)
          ) {
            matchedTool = toolData;
            break;
          }
        }
      }

      const cleanedTool = {
        name: matchedTool ? matchedTool.name : cleanName,
        reason: tool.reason || "Recommended for your project needs",
        inDirectory: !!matchedTool,
      };

      // Add URL for external tools
      if (!matchedTool && tool.url) {
        cleanedTool.url = tool.url;
      }

      cleanedCategoryTools.push(cleanedTool);
    });

    if (cleanedCategoryTools.length > 0) {
      cleanedRecommendations[category] = cleanedCategoryTools;
    }
  });

  return cleanedRecommendations;
}

const categoryTitle = {
  ai: "AI & Machine Learning",
  frontend: "Frontend",
  backend: "Backend",
  "developer-tools": "Developer Tools",
  apis: "APIs",
  database: "Database",
  debugging: "Debugging",
  testing: "Testing",
  deployment: "Deployment",
  "version-control": "Version Control",
  "package-manager": "Package Manager",
  devops: "DevOps",
  automation: "Automation",
  monitoring: "Monitoring",
  performance: "Performance",
  security: "Security",
  cli: "CLI",
  design: "Design",
  documentation: "Documentation",
  productivity: "Productivity",
  collaboration: "Collaboration",
  mobile: "Mobile",
  cloud: "Cloud",
  analytics: "Analytics",
};

function displayRecommendations(recommendations) {
  const container = document.getElementById("recommendedTools");

  const categoryIcons = {
    ai: "fas fa-robot",
    frontend: "fas fa-paint-brush",
    backend: "fas fa-server",
    "developer-tools": "fas fa-wrench",
    apis: "fas fa-plug",
    database: "fas fa-database",
    debugging: "fas fa-bug",
    testing: "fas fa-vial",
    deployment: "fas fa-cloud-upload-alt",
    "version-control": "fas fa-code-branch",
    "package-manager": "fas fa-box",
    devops: "fas fa-cogs",
    automation: "fas fa-magic",
    monitoring: "fas fa-chart-line",
    performance: "fas fa-tachometer-alt",
    security: "fas fa-shield-alt",
    cli: "fas fa-terminal",
    design: "fas fa-palette",
    documentation: "fas fa-book",
    productivity: "fas fa-rocket",
    collaboration: "fas fa-users",
    mobile: "fas fa-mobile-alt",
    cloud: "fas fa-cloud",
    analytics: "fas fa-chart-bar",
  };

  // Check if there are any recommendations
  const hasRecommendations = Object.entries(recommendations).some(
    ([_, tools]) => tools && tools.length > 0
  );

  if (!hasRecommendations) {
    container.innerHTML = `
      <div class="recommendations-empty">
        <i class="fas fa-lightbulb"></i>
        <h3>No recommendations found</h3>
        <p>Try providing more details about your project.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = Object.entries(recommendations)
    .filter(([_, tools]) => tools && tools.length > 0)
    .map(([category, categoryTools]) => {
      return `
        <div class="recommended-category">
          <div class="category-title">
            <i class="${
              categoryIcons[category.toLowerCase()] || "fas fa-tools"
            }"></i>
            ${categoryTitle[category.toLowerCase()] || category}
          </div>
          <div class="recommended-tools-list">
            ${categoryTools
              .map((rec) => {
                // Find matching tool in our directory (case-insensitive)
                const matchedTool = tools.find(
                  (tool) =>
                    tool.name.toLowerCase().trim() ===
                    rec.name.toLowerCase().trim()
                );

                // Determine if tool is in directory
                const isInDirectory = matchedTool !== undefined;
                const isExternalTool = !isInDirectory;

                return `
                <div class="recommended-tool">
                  <div class="recommended-tool-header">
                    <div class="recommended-tool-name">
                      ${matchedTool?.logo || "🔧"} ${rec.name}
                      ${
                        isExternalTool
                          ? '<span class="external-tool-badge">External</span>'
                          : ""
                      }
                    </div>
                  </div>
                  <div class="recommended-tool-reason">${rec.reason}</div>
                  <div class="recommended-tool-actions">
                    ${
                      isInDirectory
                        ? `
                      <a href="${matchedTool.url}" class="tool-action-btn visit-tool-btn" target="_blank" rel="noopener">
                        <i class="fas fa-external-link-alt"></i>
                        Visit Tool
                      </a>
                      <button class="tool-action-btn view-tool-btn" onclick="viewToolInGrid(${matchedTool.id})">
                        <i class="fas fa-eye"></i>
                        View Details
                      </button>
                    `
                        : rec.url
                        ? `
                      <a href="${rec.url}" class="tool-action-btn visit-tool-btn" target="_blank" rel="noopener">
                        <i class="fas fa-external-link-alt"></i>
                        Visit Tool
                      </a>
                    `
                        : `
                      <button class="tool-action-btn search-tool-btn" onclick="searchForTool('${rec.name}')">
                        <i class="fas fa-search"></i>
                        Search Online
                      </button>
                    `
                    }
                  </div>
                </div>
              `;
              })
              .join("")}
          </div>
        </div>
      `;
    })
    .join("");
}

// Helper function to search for external tools
function searchForTool(toolName) {
  // Clean the tool name for better search results
  const searchQuery = toolName.replace(/[^\w\s]/g, "").trim();
  window.open(
    `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`,
    "_blank"
  );
}

function viewToolInGrid(toolId) {
  // Close recommendations modal
  recommendationsModal.classList.remove("active");
  document.body.style.overflow = "";

  // Clear filters and search to show all tools
  clearFilters();

  // Scroll to the tool card
  setTimeout(() => {
    const toolCard = document.querySelector(`[data-id="${toolId}"]`);
    if (toolCard) {
      toolCard.scrollIntoView({ behavior: "smooth", block: "center" });
      toolCard.style.border = "2px solid var(--accent)";
      toolCard.style.boxShadow = "0 0 20px rgba(0, 217, 255, 0.3)";

      setTimeout(() => {
        toolCard.style.border = "";
        toolCard.style.boxShadow = "";
      }, 3000);
    }
  }, 100);
}

// Initialize the app
init();
