import { expect, type Page } from '@playwright/test';

export async function addObject(page: Page, name: string) {
  await page.getByText(name, { exact: true }).first().locator('..').getByRole('button', { name: 'Add' }).click();
}

export async function enablePlayer(page: Page) {
  await addObject(page, 'Box');
  await page.getByRole('button', { name: 'Select', exact: true }).first().click();
  await page.getByRole('button', { name: 'Character Controller', exact: true }).click();
  await page.getByRole('region', { name: 'Character Controller' }).getByRole('checkbox').first().check();
}

export async function playerState(page: Page) {
  return page.evaluate(async () => {
    const modulePath = '/src/store/editorStore.ts';
    const { useEditorStore } = await import(/* @vite-ignore */ modulePath);
    const state = useEditorStore.getState();
    const player = state.sceneObjects[0];
    return {
      position: player.object.position.toArray() as number[],
      grounded: player.properties.characterController?.isGrounded as boolean,
      playing: state.isPlaying as boolean,
    };
  });
}

export async function play(page: Page) {
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeVisible();
  await page.locator('canvas').click({ position: { x: 10, y: 10 } });
}
