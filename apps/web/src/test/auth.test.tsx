import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { BrowserRouter } from 'react-router';
import { Login } from '../features/auth/Login';
import { RecoverPassword } from '../features/auth/RecoverPassword';

describe('Flujos de Autenticación', () => {
  it('Debe renderizar la pantalla de inicio de sesión con los campos esperados', () => {
    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );
    
    expect(screen.getByText('Iniciar sesión en NexoKids')).toBeInTheDocument();
    expect(screen.getByLabelText('Correo electrónico')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Iniciar sesión/i })).toBeInTheDocument();
  });

  it('Debe renderizar la pantalla de recuperación de contraseña', () => {
    render(
      <BrowserRouter>
        <RecoverPassword />
      </BrowserRouter>
    );
    
    expect(screen.getByText('Recuperar Contraseña')).toBeInTheDocument();
    expect(screen.getByLabelText('Correo electrónico')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Enviar enlace/i })).toBeInTheDocument();
  });
});
