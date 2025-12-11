# Requirements Document

## Introduction

This document defines the requirements for enhancing the Market Board stock monitoring application. The enhancements focus on improving user interaction, mobile responsiveness, code maintainability, and application stability.

## Glossary

- **Market Board**: The stock monitoring web application
- **Stock Row**: A table row displaying a single stock's information
- **Tooltip**: A floating element showing the intraday chart when hovering over a stock
- **Sort**: Reordering table rows based on a column's values
- **Price Flash**: A brief visual highlight animation when a stock's price changes

## Requirements

### Requirement 1: Table Sorting

**User Story:** As a user, I want to sort the stock table by different columns, so that I can quickly identify top performers or most active stocks.

#### Acceptance Criteria

1. WHEN a user clicks on the "涨跌幅" column header THEN the system SHALL sort all rows by percentage change in descending order
2. WHEN a user clicks on the "成交额" column header THEN the system SHALL sort all rows by trading amount in descending order
3. WHEN a user clicks on the "最新价" column header THEN the system SHALL sort all rows by current price in descending order
4. WHEN a user clicks a sortable column header twice THEN the system SHALL toggle between ascending and descending order
5. WHEN sorting is active THEN the system SHALL display a visual indicator on the sorted column header

### Requirement 2: Price Change Highlight

**User Story:** As a user, I want to see visual feedback when stock prices update, so that I can quickly notice which stocks have changed.

#### Acceptance Criteria

1. WHEN a stock's price changes during a refresh THEN the system SHALL apply a brief highlight animation to the price cell
2. WHEN the price increases THEN the system SHALL use a red highlight color
3. WHEN the price decreases THEN the system SHALL use a green highlight color
4. WHEN the highlight animation completes THEN the system SHALL restore the cell to its normal appearance

### Requirement 3: Mobile Responsive Design

**User Story:** As a mobile user, I want the application to display properly on small screens, so that I can monitor stocks on my phone.

#### Acceptance Criteria

1. WHEN the viewport width is less than 768px THEN the system SHALL hide the "成交额" column to reduce horizontal scrolling
2. WHEN the viewport width is less than 768px THEN the system SHALL reduce cell padding for a more compact display
3. WHEN the viewport width is less than 768px THEN the system SHALL adjust font sizes for better readability

### Requirement 4: Settings Modal Improvements

**User Story:** As a user, I want a more intuitive settings experience, so that I can easily manage my watchlist.

#### Acceptance Criteria

1. WHEN a user selects a stock from search results THEN the system SHALL blur the search input and clear its value
2. WHEN a user enters a valid stock code manually (e.g., "600000" or "sh600000") THEN the system SHALL allow adding it directly without search
3. WHEN a user presses Enter in the manual input field THEN the system SHALL attempt to add the entered code

### Requirement 5: Code Structure - Event Binding

**User Story:** As a developer, I want clean separation between HTML and JavaScript, so that the code is more maintainable and testable.

#### Acceptance Criteria

1. WHEN the application initializes THEN the system SHALL bind all button click events using addEventListener instead of inline onclick
2. WHEN event handlers are bound THEN the system SHALL use element IDs for button identification

### Requirement 6: Code Structure - DOM Caching

**User Story:** As a developer, I want frequently accessed DOM elements cached, so that the application performs better and code is more readable.

#### Acceptance Criteria

1. WHEN the application initializes THEN the system SHALL cache references to frequently used DOM elements
2. WHEN rendering or updating the UI THEN the system SHALL use cached element references instead of repeated getElementById calls

### Requirement 7: Data Safety - Safe Float Parsing

**User Story:** As a developer, I want safe number parsing, so that the application handles malformed data gracefully.

#### Acceptance Criteria

1. WHEN parsing numeric values from the API THEN the system SHALL use a safe parsing function that returns a fallback value for NaN
2. WHEN a parsed value is NaN or undefined THEN the system SHALL use 0 as the default fallback

### Requirement 8: Error Handling - JSONP Failures

**User Story:** As a user, I want clear feedback when data fetching fails, so that I know the application status.

#### Acceptance Criteria

1. WHEN a JSONP script fails to load THEN the system SHALL reject the promise with an error
2. WHEN data fetching fails THEN the system SHALL display an error status to the user
3. WHEN parsing fetched data throws an error THEN the system SHALL handle it gracefully and show error status

### Requirement 9: Race Condition Prevention

**User Story:** As a user, I want consistent data display, so that rapid refreshes don't cause stale data to appear.

#### Acceptance Criteria

1. WHEN multiple fetch requests are in flight THEN the system SHALL only process the most recent request's response
2. WHEN an older request completes after a newer one THEN the system SHALL discard the older response

### Requirement 10: Search Cleanup

**User Story:** As a developer, I want proper cleanup of search resources, so that there are no memory leaks or stale data.

#### Acceptance Criteria

1. WHEN search results are processed THEN the system SHALL delete the global suggestdata variable
2. WHEN a search script fails to load THEN the system SHALL display a "搜索失败" message to the user

### Requirement 11: Tooltip Delay

**User Story:** As a user, I want the chart tooltip to appear smoothly, so that brief mouse movements don't cause flickering.

#### Acceptance Criteria

1. WHEN a user hovers over a stock row THEN the system SHALL wait 200ms before showing the tooltip
2. WHEN the user moves away before 200ms THEN the system SHALL not show the tooltip
3. WHEN the user moves to a different row within 200ms THEN the system SHALL cancel the previous tooltip and start a new delay
