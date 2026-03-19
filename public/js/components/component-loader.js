// Component loader: loads component definitions and makes them available
// Components are loaded as text and will be executed in the Babel context

export async function loadComponents() {
  const componentFiles = [
    'MoneriumConnectPanel',
    'InvoiceCard',
    'PDFSidebar',
    'InvoiceDetailsView',
    'MonthlyInvoicesView',
    'App',
    'HomePage',
    'CollectivesPage',
    'RootApp',
  ];

  const components = {};
  
  for (const componentName of componentFiles) {
    try {
      const response = await fetch(`/js/components/${componentName}.jsx`);
      if (response.ok) {
        components[componentName] = await response.text();
      }
    } catch (err) {
      console.error(`Failed to load component ${componentName}:`, err);
    }
  }

  return components;
}

