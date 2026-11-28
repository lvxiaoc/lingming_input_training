import { useCallback, useEffect, useState } from 'react';
import {
  buildA4LandscapePrintDataUrls,
  CloudPosterRenderOptions,
} from '../utils/topologyCloudPdf';

export function useTopologyAtlasPrint(
  defaultOpts: Omit<CloudPosterRenderOptions, 'scale'>
) {
  const [printUrls, setPrintUrls] = useState<string[]>([]);
  const [isPreparingPrint, setIsPreparingPrint] = useState(false);

  useEffect(() => {
    const handleAfterPrint = () => {
      setPrintUrls([]);
      setIsPreparingPrint(false);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  const triggerPrint = useCallback(
    async (overrideOpts?: Partial<Omit<CloudPosterRenderOptions, 'scale'>>) => {
      if (isPreparingPrint) return;
      setIsPreparingPrint(true);
      try {
        const urls = await buildA4LandscapePrintDataUrls({
          ...defaultOpts,
          ...overrideOpts,
          pages: 'both',
        });
        setPrintUrls(urls);
        // Ensure React commits the print-only <img> nodes before window.print() snapshots the DOM
        await new Promise<void>((resolve) => {
          window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => resolve());
          });
        });
        window.print();
      } finally {
        window.setTimeout(() => {
          setIsPreparingPrint(false);
        }, 400);
      }
    },
    [defaultOpts, isPreparingPrint]
  );

  return {
    printUrls,
    isPreparingPrint,
    triggerPrint,
  };
}
