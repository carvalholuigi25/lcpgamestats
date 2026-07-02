(function (global) {
  const AppUtils = {
    formatPlaytime(minutes) {
      if (!minutes || minutes <= 0) return 'Never played';
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      if (hours === 0) return `${mins}m`;
      if (mins === 0) return `${hours}h`;
      return `${hours}h ${mins}m`;
    },
    formatHoursShort(minutes) {
      return (minutes / 60).toFixed(1);
    },
    escapeHtml(str) {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    },
    debounce(fn, delay) {
      let timer;
      return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
      };
    },
    normalizePageSizeValue(value) {
      const pageSize = Number(value);
      if (!Number.isInteger(pageSize) || pageSize < 1) return 24;
      return Math.min(Math.max(pageSize, 1), 100);
    }
  };

  global.AppUtils = AppUtils;
})(window);
